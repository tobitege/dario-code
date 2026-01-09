#!/usr/bin/env node
/**
 * Quick Eval Test - Run one test and show results
 */

import { runEval } from './runner.mjs'
import { judgeResult, generateReport } from './judge.mjs'

const prompt = process.argv[2] || 'Read package.json and tell me the project name'


try {
  const result = await runEval(prompt, { verbose: false })
  const judgment = judgeResult(result)

} catch (error) {
  console.error('❌ Test failed:', error.message || error.error)
  process.exit(1)
}
