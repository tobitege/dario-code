---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, bug, diff, correctness]
---

# 002 — Diff hunk headers always show line 1 (oldStart/newStart always 0)

## Problem Statement

`finishHunk()` in `src/utils/diff.mjs` initialises `oldStart` and `newStart` to `0` and never updates them. Every unified diff hunk header emits `@@ -1,N +1,M @@` regardless of where in the file the change actually occurs. For a change at line 400, the header still says `-1`.

## Findings

**File:** `src/utils/diff.mjs:124–136`

```js
function finishHunk(hunk) {
  let oldStart = 0, newStart = 0, oldCount = 0, newCount = 0
  for (const c of hunk.changes) {
    if (c.type === 'context') { oldCount++; newCount++ }
    else if (c.type === 'add') { newCount++ }
    else if (c.type === 'remove') { oldCount++ }
  }
  hunk.oldStart = oldStart   // ← always 0
  hunk.newStart = newStart   // ← always 0
  hunk.oldCount = oldCount
  hunk.newCount = newCount
}
```

The comment "These are approximate — fine for display" understates the problem: the values are always wrong for any edit that doesn't begin at line 1.

## Root Cause

`myersDiff` returns change objects without carrying line-number metadata (`oi`/`ni` positions). `computeHunks` groups them into hunks but doesn't track the starting indices. `finishHunk` has no way to derive `oldStart`/`newStart` from the changes alone without a structural fix.

## Proposed Solutions

### Option A — Track positions through myersDiff (Recommended)

Return `{ type, line, oldIdx, newIdx }` from `myersDiff`, then track the first old/new index seen in each hunk:

```js
// In myersDiff, emit index metadata:
result.push({ type: 'equal', line: oldLines[oi], oldIdx: oi, newIdx: ni })
result.push({ type: 'delete', line: oldLines[oi], oldIdx: oi })
result.push({ type: 'insert', line: newLines[ni], newIdx: ni })

// In computeHunks, set hunk start from first seen index:
if (!currentHunk.oldStartSet && change.oldIdx !== undefined) {
  currentHunk.oldStart = change.oldIdx
  currentHunk.oldStartSet = true
}
```

- **Pros:** Correct line numbers, minimal API change
- **Cons:** Medium refactor touching myersDiff output shape
- **Effort:** Medium

### Option B — Replace with `diff` npm package

Use the well-tested `diff` package (0 dependencies, very small) instead of the custom algorithm:

```js
import { createPatch } from 'diff'
export function generateDiff(oldText, newText, filename = 'file') {
  return createPatch(filename, oldText, newText)
}
```

- **Pros:** Correct output, no maintenance burden, eliminates diff.mjs
- **Cons:** Adds a dependency (though `diff` is extremely stable)
- **Effort:** Small

### Option C — Document as display-only limitation

Add a comment explaining the limitation and note that hunk headers are for visual context only (not for editor navigation).

- **Pros:** No code change
- **Cons:** Wrong behaviour remains, users will notice if they try to use the line numbers
- **Effort:** Trivial

## Technical Details

- **Affected files:** `src/utils/diff.mjs`
- **Also affects:** Issue 003 (diff algorithm correctness) — both may be solved together by Option B

## Acceptance Criteria
- [ ] `generateDiff('a\nb\nc', 'a\nX\nc', 'file')` returns hunk header `@@ -2,1 +2,1 @@` (not `@@ -1,1 +1,1 @@`)
- [ ] `npm run test:unit` passes

## Work Log

- 2026-02-17: Identified by code-review and performance agents. Both independently confirmed `finishHunk` always emits 0 for start positions.
