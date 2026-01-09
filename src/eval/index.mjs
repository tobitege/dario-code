#!/usr/bin/env node
/**
 * Eval System - Run evals and feed improvements back
 */

import { runEval } from './runner.mjs'
import { judgeResult, generateReport } from './judge.mjs'
import { analyzeFeedback, saveFeedback } from './feedback.mjs'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const TEST_CASES = [
  {
    name: 'simple_read',
    prompt: 'Read the README.md file and tell me what this project does in one sentence',
    expectedTools: ['Read'],
    expectedBehavior: 'Should read file and summarize'
  },
  {
    name: 'search_and_edit',
    prompt: 'Find all console.log statements in src/ and remove them',
    expectedTools: ['Grep', 'Read', 'Edit'],
    expectedBehavior: 'Should search, read files, then edit'
  },
  {
    name: 'create_file',
    prompt: 'Create a test file at /tmp/test.txt with content "Hello World"',
    expectedTools: ['Write'],
    expectedBehavior: 'Should write file directly'
  },
  {
    name: 'fix_bug',
    prompt: 'Fix the React duplicate key warning we fixed earlier',
    expectedTools: ['Grep', 'Read', 'Edit'],
    expectedBehavior: 'Should search for issue, read code, fix it'
  }
]

async function runAllEvals() {
  const resultsDir = join(process.cwd(), '.evals', 'runs', new Date().toISOString().split('T')[0])
  await mkdir(resultsDir, { recursive: true })

  const results = []


  for (const testCase of TEST_CASES) {
    console.error(`\n▶️  Running: ${testCase.name}`)
    console.error(`   Prompt: ${testCase.prompt}`)

    try {
      const result = await runEval(testCase.prompt, { verbose: false })
      const judgment = judgeResult(result)

      results.push({
        testCase,
        result,
        judgment
      })

      console.error(`   ✓ Passed: ${judgment.grade} (${(judgment.overall * 100).toFixed(1)}%)`)

      // Save individual result
      await writeFile(
        join(resultsDir, `${testCase.name}.json`),
        JSON.stringify({ testCase, result, judgment }, null, 2)
      )

    } catch (error) {
      console.error(`   ❌ Failed: ${error.error || error.message}`)
      results.push({
        testCase,
        error: error.error || error.message,
        judgment: { overall: 0, grade: 'F' }
      })
    }
  }

  // Generate summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: results.filter(r => r.judgment?.grade !== 'F').length,
    failed: results.filter(r => r.judgment?.grade === 'F').length,
    averageScore: results.reduce((sum, r) => sum + (r.judgment?.overall || 0), 0) / results.length,
    results: results.map(r => ({
      name: r.testCase.name,
      grade: r.judgment?.grade || 'F',
      score: r.judgment?.overall || 0
    }))
  }

  await writeFile(
    join(resultsDir, 'summary.json'),
    JSON.stringify(summary, null, 2)
  )

  for (const r of summary.results) {
    const emoji = r.grade === 'F' ? '❌' : r.grade === 'A' ? '✅' : '⚠️'
  }

  // Generate feedback and improvement plan
  const feedback = analyzeFeedback(results)
  await saveFeedback(summary, feedback)

  return summary
}

async function analyzeTrends() {
  const runsDir = join(process.cwd(), '.evals', 'runs')
  if (!existsSync(runsDir)) {
    return
  }

  // Read all summary files
  // TODO: Implement trend analysis
}

// CLI
const command = process.argv[2]

if (command === 'run') {
  runAllEvals().catch(console.error)
} else if (command === 'trends') {
  analyzeTrends().catch(console.error)
} else {
}
