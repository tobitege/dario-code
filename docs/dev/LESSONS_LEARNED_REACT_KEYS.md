# React Duplicate Key Warnings

## Problem
React was throwing warnings about duplicate keys:
```
Warning: Encountered two children with the same key, `6d77467f-35c1-4834-a86f-9394eeb05ed9b`
```

## Root Cause
In `src/utils/messages.mjs`, the `normalizeMessages()` function was creating multiple messages from a single source message using spread operator:

```javascript
normalized.push({
  ...msg,  // ❌ Copies original uuid
  type: 'assistant',
  // ...
})
normalized.push({
  ...msg,  // ❌ Same uuid again!
  message: { ... }
})
```

When a user message contained tool_results, it would be expanded into multiple messages (assistant tool_use + user tool_result), but all would share the SAME uuid from the original message.

## Solution
Generate new UUIDs for expanded messages:

```javascript
normalized.push({
  ...msg,
  uuid: randomUUID(),  // ✅ Unique UUID
  type: 'assistant',
  // ...
})
normalized.push({
  ...msg,
  uuid: randomUUID(),  // ✅ Unique UUID
  message: { ... }
})
```

## Additional Issues Fixed
1. **Tool name and icon on separate lines**: Status icon and tool name were in separate Text elements. Fixed by wrapping both in single Text element (line 837-839).

2. **"Unknown" tool names displayed**: Synthetic tool_use messages created by `normalizeMessages()` had `name: 'unknown'` because they were placeholders for tool_results without the original tool_use context. Fixed by skipping rendering of tool_use with name='unknown' (line 812).

## Files Changed
- `src/utils/messages.mjs` - Added `uuid: randomUUID()` to expanded messages (lines 45, 62)
- `src/tui/claude/main.mjs` - Improved key props to use content IDs (lines 660, 684), fixed tool rendering layout (line 837-839), skip unknown tools (line 812)
- `tests/messages.test.mjs` - Added tests to prevent regression

## Prevention
- **ALWAYS** generate unique UUIDs when creating new message objects
- **NEVER** use array index as React key if array can change
- **TEST** that UUIDs are unique in normalization/transformation functions
- **USE** content IDs (`item.id`, `item.tool_use_id`) as React keys when available

## Testing
Run `npx vitest run tests/messages.test.mjs` to verify UUID uniqueness.
