/**
 * Feedback Loop - Analyze failures and generate improvement suggestions
 */

import { writeFile, appendFile } from 'fs/promises'
import { join } from 'path'

export function analyzeFeedback(results) {
  const failures = results.filter(r => r.judgment?.overall < 0.7)
  const improvements = []

  for (const failure of failures) {
    const { testCase, result, judgment } = failure

    // Skip if no judgment (test failed to run)
    if (!judgment || !judgment.scores) continue

    // Analyze what went wrong
    const issues = []

    if (judgment.scores.tool_usage < 0.7) {
      issues.push({
        category: 'tool_usage',
        description: `Tool errors in "${testCase.name}"`,
        suggestion: 'Review error handling in tool implementations',
        files: extractToolFiles(result.toolCalls, result.errors)
      })
    }

    if (judgment.scores.methodology < 0.7) {
      const methodologyIssues = judgment.feedback.filter(f => f.startsWith('⚠️'))
      for (const issue of methodologyIssues) {
        if (issue.includes('without reading first')) {
          issues.push({
            category: 'methodology',
            description: 'Editing files without reading first',
            suggestion: 'Update system prompt to emphasize Read-before-Edit pattern',
            files: ['src/prompts/system.mjs']
          })
        }
        if (issue.includes('could use Task tool')) {
          issues.push({
            category: 'methodology',
            description: 'Too many sequential searches',
            suggestion: 'Improve search tools or add batching capability',
            files: ['src/tools/grep.mjs', 'src/tools/glob.mjs']
          })
        }
        if (issue.includes('instead of dedicated tools')) {
          issues.push({
            category: 'tool_selection',
            description: 'Using Bash for searches',
            suggestion: 'System prompt should discourage Bash for file operations',
            files: ['src/prompts/system.mjs']
          })
        }
      }
    }

    if (judgment.scores.efficiency < 0.5) {
      issues.push({
        category: 'efficiency',
        description: `High tool usage (${result.toolCalls.length} calls)`,
        suggestion: 'Investigate why so many tool calls needed',
        files: []
      })
    }

    improvements.push(...issues)
  }

  return {
    totalFailures: failures.length,
    improvements: deduplicateImprovements(improvements)
  }
}

function extractToolFiles(toolCalls, errors) {
  const files = new Set()
  const errorToolIds = new Set(errors.map(e => e.tool_use_id))

  for (const call of toolCalls) {
    if (errorToolIds.has(call.id)) {
      // Map tool name to implementation file
      const toolFile = `src/tools/${call.name.toLowerCase()}.mjs`
      files.add(toolFile)
    }
  }

  return Array.from(files)
}

function deduplicateImprovements(improvements) {
  const seen = new Set()
  const unique = []

  for (const improvement of improvements) {
    const key = `${improvement.category}:${improvement.description}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(improvement)
    }
  }

  return unique
}

export async function generateImprovementPlan(summary, feedback) {
  const plan = []

  plan.push('# Improvement Plan')
  plan.push(`Generated: ${new Date().toISOString()}`)
  plan.push(`Based on ${summary.totalTests} eval runs`)
  plan.push(`Average Score: ${(summary.averageScore * 100).toFixed(1)}%`)
  plan.push('')

  if (feedback.improvements.length === 0) {
    plan.push('✅ No improvements needed - all evals passed!')
    return plan.join('\n')
  }

  plan.push('## Issues Identified')
  plan.push('')

  const byCategory = {}
  for (const improvement of feedback.improvements) {
    if (!byCategory[improvement.category]) {
      byCategory[improvement.category] = []
    }
    byCategory[improvement.category].push(improvement)
  }

  for (const [category, issues] of Object.entries(byCategory)) {
    plan.push(`### ${category.toUpperCase()}`)
    plan.push('')
    for (const issue of issues) {
      plan.push(`**${issue.description}**`)
      plan.push(`- Suggestion: ${issue.suggestion}`)
      if (issue.files.length > 0) {
        plan.push(`- Files: ${issue.files.join(', ')}`)
      }
      plan.push('')
    }
  }

  plan.push('## Next Steps')
  plan.push('')
  plan.push('1. Review the suggestions above')
  plan.push('2. Update identified files')
  plan.push('3. Re-run evals to verify improvements')
  plan.push('4. Iterate until all tests pass')

  return plan.join('\n')
}

export async function saveFeedback(summary, feedback) {
  const feedbackDir = join(process.cwd(), '.evals', 'feedback')
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]

  const plan = await generateImprovementPlan(summary, feedback)

  await writeFile(
    join(feedbackDir, `${timestamp}-plan.md`),
    plan
  )

  await appendFile(
    join(feedbackDir, 'history.jsonl'),
    JSON.stringify({ timestamp, summary, feedback }) + '\n'
  )


  return plan
}
