/**
 * Test/Demo file for mentions module
 * Run with: node src/mentions/test.mjs
 */

import {
  parseMentions,
  resolveMention,
  processMentions,
  formatMentionsSummary,
  createMentionContext,
  getTabCompletions
} from './index.mjs'

// Test 1: Parse mentions from input
const input1 = 'Can you review @src/core/utils.mjs and @CLAUDE.md?'
const mentions1 = parseMentions(input1)

// Test 2: Resolve single file
resolveMention('CLAUDE.md').then(result => {
    success: result.success,
    path: result.path,
    size: result.size,
    hasContent: !!result.content
  })
})

// Test 3: Process multiple mentions
const input3 = 'Fix @src/core/utils.mjs and review @README.md'
processMentions(input3).then(results => {
})

// Test 4: Tab completion
const completions = getTabCompletions('@src/')
completions.slice(0, 5).forEach(c => {
})

// Test 5: Parse glob pattern
const input5 = 'Check all test files @**/*.test.mjs'
const mentions5 = parseMentions(input5)
if (mentions5.length > 0) {
}
