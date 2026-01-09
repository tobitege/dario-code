---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, performance, tui, commands]
---

# 003 — execFileSync blocks event loop in /review and /pr-comments

## Problem Statement

The `/review` and `/pr-comments` commands use `execFileSync` (synchronous child process) inside async functions. This blocks the Node.js event loop for up to 15 seconds during git/gh operations, freezing TUI animations, preventing Ctrl+C handling, and blocking all concurrent async work.

## Findings

**File:** `src/cli/commands.mjs`

| Call | Timeout | Risk |
|---|---|---|
| `execFileSync('git', ['diff'], ...)` | 10,000ms | Blocks on large monorepos |
| `execFileSync('gh', ['pr', 'view', ...])` | 15,000ms | Blocks on slow GitHub API |
| `execFileSync('git', ['rev-parse', ...])` | 5,000ms | Low risk |
| `execFileSync('which', ['gh'])` | none | ~1ms, but still blocking |

During the wait, the Ink TUI cannot repaint, keyboard input is dropped, and `process.on('SIGINT')` is not triggered cleanly.

## Proposed Solutions

### Option A — promisify execFile (Recommended)

Replace `execFileSync` with the async `execFile` via `promisify`:

```js
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

// In reviewCommand.call():
const { stdout: diff } = await execFileAsync('git', ['diff', '--cached'], { timeout: 10000 })
if (!diff.trim()) return 'No staged changes...'
```

- **Pros:** Non-blocking, Ctrl+C works, animations continue
- **Cons:** Slightly more verbose error handling (stdout/stderr on error objects)
- **Effort:** Small (mechanical replacement)
- **Risk:** Low

### Option B — Dynamic import of execFileAsync at call time

```js
const { execFile } = await import('child_process')
const { promisify } = await import('util')
const execFileAsync = promisify(execFile)
```

- **Pros:** Same as A, avoids adding top-level imports to large commands.mjs
- **Cons:** Slightly more verbose; dynamic import already used in the file for execFileSync
- **Effort:** Small

### Option C — Keep execFileSync, accept the blocking

Document that these commands will freeze the TUI briefly. Acceptable for a v1.0.0 CLI tool where the commands are rarely called.

- **Pros:** No change required
- **Cons:** 15-second freezes are very noticeable to users; Ctrl+C may not work during hang
- **Effort:** Trivial

## Technical Details

- **Affected files:** `src/cli/commands.mjs` — `reviewCommand` and `prCommentsCommand`
- **Affected TUI:** Ink renderer, keyboard handler, prompt-footer context bar

## Acceptance Criteria
- [ ] `/review` command does not block TUI rendering during git diff execution
- [ ] `/pr-comments` command allows Ctrl+C to interrupt during gh API call
- [ ] `npm run test:unit` passes
- [ ] Manual test: open TUI, run `/pr-comments` on a PR, verify spinner/footer still updates

## Work Log

- 2026-02-17: Identified by performance-oracle agent. Applies to both new commands added in v1.0.0.
