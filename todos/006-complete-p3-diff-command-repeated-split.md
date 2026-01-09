---
status: pending
priority: p3
issue_id: "006"
tags: [code-review, performance, quality, commands]
---

# 006 — /review command: diff.split('\n') called 4 times, dead variable

## Problem Statement

The `/review` command calls `diff.split('\n')` four times on the same string. A `lines` variable is computed but then ignored in the truncation check, which re-splits instead.

## Findings

**File:** `src/cli/commands.mjs` — `reviewCommand`

```js
const lines = diff.split('\n').length           // call 1 — stored in 'lines' but unused below
const files = diff.match(/^diff --git/gm)?.length || 0

let output = `... Files: ${files} · Lines: ${lines}\n\n`  // ← 'lines' used here only

const maxLines = 200
const diffLines = diff.split('\n').slice(0, maxLines)    // call 2

if (diff.split('\n').length > maxLines) {                // call 3 — should use 'lines'
  output += `\n  ... (${diff.split('\n').length - maxLines} more lines truncated)\n`  // call 4
}
```

The `lines` variable is used only in the header output, then the same computation is repeated twice more in the truncation block.

## Proposed Solutions

### Option A — Cache the split result (Recommended)

```js
const allLines = diff.split('\n')
const lineCount = allLines.length
const files = diff.match(/^diff --git/gm)?.length || 0

let output = `... Files: ${files} · Lines: ${lineCount}\n\n`

const maxLines = 200
const diffLines = allLines.slice(0, maxLines)

if (lineCount > maxLines) {
  output += `\n  ... (${lineCount - maxLines} more lines truncated)\n`
}
```

- **Effort:** Trivial
- **Risk:** None

## Technical Details

- **Affected files:** `src/cli/commands.mjs` — `reviewCommand.call()`

## Acceptance Criteria
- [ ] `diff.split('\n')` called once instead of four times
- [ ] Behaviour unchanged

## Work Log

- 2026-02-17: Identified by code-review agent.
