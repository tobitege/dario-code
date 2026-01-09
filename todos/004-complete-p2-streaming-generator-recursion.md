---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, architecture, streaming, memory]
---

# 004 — streamConversation recursion grows unbounded in long agentic sessions

## Problem Statement

`streamConversation` in `src/api/streaming.mjs` calls itself recursively for tool results, auto-continue, OAuth retries, and HTTP retries. JavaScript generators do not tail-call optimise. For long agentic sessions (50+ turns), each recursion level retains a generator frame on the stack, leading to potential stack overflow and guaranteed memory growth.

## Findings

**File:** `src/api/streaming.mjs`

Recursive paths:
- Tool result continuation: `yield* streamConversation(messages + toolResults, ...)`
- Auto-continue on `stop_reason: max_tokens`
- OAuth token refresh retry
- HTTP 429/500/503 exponential backoff retry

A 50-turn agentic session with tool use produces ~50 stacked generator frames. At 500 turns (not uncommon for large code generation tasks), this is a real stack depth concern. Each retained frame also holds references to the request/response objects, preventing GC.

## Proposed Solutions

### Option A — Iterative loop with continuation state (Recommended)

Convert the recursive continuation into a `while` loop with a mutable messages accumulator:

```js
export async function* streamConversation(initialMessages, tools, systemPrompts, options = {}) {
  let messages = initialMessages
  let continueLoop = true

  while (continueLoop) {
    continueLoop = false
    // ... stream a single turn ...
    if (toolUses.length > 0) {
      const toolResults = await executeTools(toolUses, tools, options)
      messages = [...messages, assistantMsg, { role: 'user', content: toolResults }]
      continueLoop = true  // next iteration handles continuation
    }
    if (stopReason === 'max_tokens' && options.autoContinue) {
      continueLoop = true
    }
  }
}
```

- **Pros:** O(1) stack depth, memory released per turn, Ctrl+C interrupts the while loop cleanly
- **Cons:** Significant refactor — generator delegation (`yield*`) is replaced by `yield` within the loop; requires careful message accumulation
- **Effort:** Large
- **Risk:** Medium — core streaming path changes

### Option B — Limit recursion depth

Add a `_depth` counter to `options` and stop when it exceeds a configurable max (e.g., 100):

```js
const depth = (options._depth || 0) + 1
if (depth > 100) {
  yield createMessage('assistant', '[Max recursion depth reached. Session too long.]')
  return
}
// ...
yield* streamConversation(messages, tools, systemPrompts, { ...options, _depth: depth })
```

- **Pros:** Small change, protects against stack overflow
- **Cons:** Doesn't fix memory growth from retained frames; arbitrary limit
- **Effort:** Small
- **Risk:** Low

### Option C — Accept current behaviour, document limitation

For typical sessions (< 50 turns), this is not a production issue. Document the limitation in comments and defer to v2.0.

- **Pros:** No change
- **Cons:** Long agentic sessions (automated pipelines, large refactors) may hit the limit
- **Effort:** Trivial

## Technical Details

- **Affected files:** `src/api/streaming.mjs`
- **Related:** `--max-turns` flag (already added in v1.0.0) provides a user-level mitigation

## Acceptance Criteria
- [ ] A 200-turn agentic session does not produce a stack overflow
- [ ] Memory usage does not grow proportionally with turn count
- [ ] `npm run test:all` passes (streaming integration tests)

## Work Log

- 2026-02-17: Identified by performance-oracle agent. Note: the `--max-turns` flag added in v1.0.0 partially mitigates this by capping at a user-specified limit.
