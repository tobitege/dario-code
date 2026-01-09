---
status: pending
priority: p3
issue_id: "005"
tags: [code-review, security, validation, commands]
---

# 005 — /pr-comments prArg not validated as numeric integer

## Problem Statement

`/pr-comments` passes `args[0]` directly to `execFileSync('gh', ['pr', 'view', prArg, ...])` without validating it is a numeric PR number. While classic shell injection is not possible (execFileSync uses argv, not shell), unvalidated input can trigger unintended gh CLI flag parsing and provides poor UX for invalid input.

## Findings

**File:** `src/cli/commands.mjs` — `prCommentsCommand`

```js
const prNumber = args[0] || ''
// ...
let prArg = prNumber
// ...
const prJson = execFileSync('gh', ['pr', 'view', prArg, '--json', '...'], ...)
```

A user could pass `/pr-comments --help`, `/pr-comments ../evil`, etc. `gh` CLI may interpret `--help` as a flag rather than a positional argument, depending on its argument parser.

## Proposed Solutions

### Option A — Numeric validation (Recommended)

```js
const rawArg = args[0] || ''
if (rawArg && !/^\d+$/.test(rawArg)) {
  return '✗ PR number must be a positive integer. Usage: /pr-comments <number>'
}
const prArg = rawArg
```

- **Pros:** One line, eliminates ambiguity, gives clear error message
- **Effort:** Trivial
- **Risk:** None

### Option B — parseInt validation

```js
const prArg = args[0] ? String(parseInt(args[0], 10)) : ''
if (args[0] && prArg === 'NaN') {
  return '✗ PR number must be a number. Usage: /pr-comments <number>'
}
```

- **Pros:** Same result as A
- **Cons:** Slightly less readable
- **Effort:** Trivial

## Technical Details

- **Affected files:** `src/cli/commands.mjs` — `prCommentsCommand`

## Acceptance Criteria
- [ ] `/pr-comments --help` returns a clear error, does not pass `--help` to gh
- [ ] `/pr-comments 123` continues to work correctly
- [ ] `/pr-comments abc` returns a clear error message

## Work Log

- 2026-02-17: Identified by security-sentinel agent. Severity is low (no shell injection possible via execFileSync), but input validation is good hygiene.
