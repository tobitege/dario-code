#!/usr/bin/env node

/**
 * Async test of mentions module with file resolution
 */

import { parseMentions, resolveMention, processMentions, createMentionContext, formatMentionsSummary } from './src/mentions/index.mjs'

console.log('=== Mentions Module Async Test ===\n')

// Test 1: Resolve single file
console.log('Test 1: Resolve single file (@CLAUDE.md)')
try {
  const result = await resolveMention('@CLAUDE.md')
  console.log('Success:', result.success)
  if (result.success) {
    console.log('Path:', result.path)
    console.log('Size:', result.size, 'bytes')
    console.log('Content preview:', result.content.slice(0, 100).replace(/\n/g, ' ') + '...')
  } else {
    console.log('Error:', result.error)
  }
} catch (e) {
  console.error('Exception:', e.message)
}
console.log()

// Test 2: Process multiple files
console.log('Test 2: Process multiple mentions')
try {
  const input = 'Review @CLAUDE.md and @README.md'
  const results = await processMentions(input)
  console.log('Input:', input)
  console.log('Mentions processed:', results.mentions.length)
  console.log('Files found:', results.files.length)
  console.log('Warnings:', results.warnings.length)
  console.log()
  console.log('Summary:')
  console.log(formatMentionsSummary(results))
} catch (e) {
  console.error('Error:', e.message)
}

// Test 3: Create mention context
console.log('Test 3: Create mention context')
try {
  const input = 'Check @package.json'
  const results = await processMentions(input)
  const context = await createMentionContext(results)
  console.log('Generated context length:', context.length, 'characters')
  console.log('Context preview:')
  console.log(context.slice(0, 200).replace(/\n/g, ' ') + '...')
} catch (e) {
  console.error('Error:', e.message)
}
console.log()

// Test 4: Handle missing files
console.log('Test 4: Handle missing files gracefully')
try {
  const input = 'Check @nonexistent-file-12345.js'
  const results = await processMentions(input)
  console.log('Input:', input)
  console.log('Warnings:', results.warnings)
} catch (e) {
  console.error('Error:', e.message)
}
console.log()

// Test 5: Glob pattern
console.log('Test 5: Glob pattern resolution')
try {
  const results = await processMentions('Check @src/mentions/*.mjs')
  console.log('Pattern: @src/mentions/*.mjs')
  console.log('Files found:', results.files.length)
  if (results.files.length > 0) {
    console.log('Files:')
    results.files.forEach(f => console.log('  -', f.split('/').slice(-2).join('/')))
  }
} catch (e) {
  console.error('Error:', e.message)
}

console.log('\n=== All Tests Completed ===')
