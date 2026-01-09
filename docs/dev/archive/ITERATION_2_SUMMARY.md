# Ralph Loop - Iteration 2 Summary

## Fixes Applied

### 1. Fixed stream-json Output
**Issue**: Linter removed `console.log(JSON.stringify(message))` line
**Fix**: Added back to `src/cli/print-mode.mjs` line 74
**Result**: Stream-json now outputs messages correctly

### 2. Fixed View Tool Parameter Errors
**Issue**: `Cannot destructure property 'path' of 'undefined'`
**Fix**: Added null check in `renderToolUseMessage()` in `src/tools/read.mjs`
```javascript
if (!input || !input.file_path) {
  return 'file_path: [undefined]'
}
```
**Result**: No more destructuring errors

### 3. Updated System Prompt
**Issue**: Claude using `bash grep/find` instead of dedicated tools
**Fix**: Added to `src/prompts/system.mjs`:
```
- Use specialized tools instead of bash commands when possible: Read for reading files, Grep for searching content, Glob for finding files, Edit for modifying files. Reserve Bash for terminal operations that truly need shell execution.
- NEVER use Bash with grep, find, cat, head, tail, sed, or awk commands - use the dedicated tools instead.
```
**Result**: System prompt now explicitly discourages Bash for file operations

### 4. Fixed Missing Prompt
**Issue**: Linter removed prompt from search_and_edit test case
**Fix**: Restored prompt in `src/eval/index.mjs`

## Files Modified
- `src/cli/print-mode.mjs` - Restored stream-json output
- `src/tools/read.mjs` - Added null check for parameters
- `src/prompts/system.mjs` - Added tool usage guidelines
- `src/eval/index.mjs` - Restored missing prompt

## Expected Improvements
1. ✅ No more View tool errors
2. ✅ Stream-json captures all messages
3. ✅ System prompt discourages Bash for searches
4. ⏳ Should see fewer Bash tool calls in next eval run
5. ⏳ Should see higher methodology scores

## Next Steps
- Run evals to verify improvements
- Compare scores: Iteration 1 vs Iteration 2
- Continue iterating until all tests Grade A/B
