---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, bug, esm, diff]
---

# 001 — require() in ES Module breaks inline diff display

## Problem Statement

`src/tools/edit.mjs` uses CommonJS `require()` inside an ES Module file. Node.js does not provide `require` in ESM scope, so this throws `ReferenceError: require is not defined` on every Edit tool call. The error is silently swallowed by a bare `catch {}`, making the inline diff feature permanently non-functional with zero signal to the developer.

## Findings

**File:** `src/tools/edit.mjs:154`

```js
try {
  const { generateDiff, formatDiffForTerminal } = require('../utils/diff.mjs')  // CRASHES
  const diffLines = generateDiff(oldString, newString, filePath)
  // ...
} catch {
  // Diff not available, skip  ← silently swallows the ReferenceError
}
```

`renderToolResultMessage` is also synchronous, so a drop-in `await import()` requires making the method async.

## Proposed Solutions

### Option A — Fix with dynamic import (Recommended)
Make `renderToolResultMessage` async and replace `require()` with `await import()`:

```js
async renderToolResultMessage({ filePath, structuredPatch, oldString, newString }, { verbose }) {
  // ...
  try {
    const { generateDiff, formatDiffForTerminal } = await import('../utils/diff.mjs')
    // ...
  } catch (e) {
    // optional: console.error('[edit diff]', e) in DEBUG mode
  }
}
```

- **Pros:** Minimal change, fixes the feature, keeps the diff utility
- **Cons:** Changes method signature to async (verify callers handle it)
- **Effort:** Small
- **Risk:** Low — catch still protects against non-ESM environments

### Option B — Remove the dead code entirely
Delete the try/catch block and leave the tool result message as the simple "Updated {filePath}" display.

- **Pros:** Simpler, removes the dependency on diff.mjs from edit.mjs
- **Cons:** Loses the inline diff feature (which was intentionally added for CC parity)
- **Effort:** Small
- **Risk:** Very low

### Option C — Pre-import at module level
Import `generateDiff` and `formatDiffForTerminal` at the top of `edit.mjs` with a try/catch:

```js
let generateDiff, formatDiffForTerminal
try {
  const diffModule = await import('../utils/diff.mjs')
  generateDiff = diffModule.generateDiff
  formatDiffForTerminal = diffModule.formatDiffForTerminal
} catch {}
```

- **Pros:** No async method signature change
- **Cons:** Top-level await requires ESM with `"type": "module"` — need to verify
- **Effort:** Small-Medium

## Technical Details

- **Affected files:** `src/tools/edit.mjs`, `src/utils/diff.mjs`
- **Callers of renderToolResultMessage:** Search for `renderToolResultMessage` across TUI render path

## Acceptance Criteria
- [ ] `renderToolResultMessage` no longer throws/catches a `require` error
- [ ] Inline diff displays correctly in TUI when Edit tool is called with differing old/new strings
- [ ] `npm run test:unit` passes
- [ ] Manual test: run `./cli.mjs`, ask Claude to edit a file, verify diff shows in output

## Work Log

- 2026-02-17: Identified by code-review agent. Confirmed via static analysis. Blocking — the new diff display feature in v1.0.0 is completely non-functional as shipped.
