---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, simplicity, quality]
---

# 007 — MODEL_LIMITS object: every value is identical (use a constant)

## Problem Statement

`MODEL_LIMITS` in `src/cli/commands.mjs` maps model names to context window sizes, but every value is `200000`. An object where all values are identical is a constant pretending to be a map.

## Findings

**File:** `src/cli/commands.mjs`

```js
const MODEL_LIMITS = {
  'claude-opus-4-6': 200000,
  'claude-sonnet-4-6': 200000,
  'claude-haiku-4-5-20251001': 200000,
  // all entries are 200000
}
// Used as:
MODEL_LIMITS[currentModel] || 200000
```

The fallback `|| 200000` also means the lookup is redundant — missing models already get 200000.

## Proposed Solution

```js
const DEFAULT_CONTEXT_TOKENS = 200_000

// Usage:
const contextLimit = DEFAULT_CONTEXT_TOKENS
```

If model-specific limits are ever needed, the constant can be upgraded to a map at that time (YAGNI).

- **Effort:** Trivial
- **Risk:** None

## Technical Details

- **Affected files:** `src/cli/commands.mjs`

## Acceptance Criteria
- [ ] `MODEL_LIMITS` object removed
- [ ] `DEFAULT_CONTEXT_TOKENS` constant used in its place
- [ ] Behaviour unchanged

## Work Log

- 2026-02-17: Identified by code-simplicity-reviewer agent.
