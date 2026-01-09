/**
 * Eval Judge - Evaluate results using various criteria
 */

export function judgeResult(result) {
  const scores = {}
  const feedback = []

  // 1. SUCCESS: Did it complete without errors?
  scores.success = result.exitCode === 0 ? 1.0 : 0.0
  if (result.exitCode !== 0) {
    feedback.push(`Failed with exit code ${result.exitCode}`)
  }

  // 2. TOOL USAGE: Did it use tools effectively?
  const toolCallCount = result.toolCalls.length
  const toolErrorCount = result.errors.length
  const toolSuccessRate = toolCallCount > 0
    ? (toolCallCount - toolErrorCount) / toolCallCount
    : 1.0

  scores.tool_usage = toolSuccessRate
  feedback.push(`Used ${toolCallCount} tools, ${toolErrorCount} errors (${(toolSuccessRate * 100).toFixed(1)}% success)`)

  // 3. EFFICIENCY: Tool calls per response
  const efficiency = toolCallCount === 0 ? 1.0 : Math.max(0, 1 - (toolCallCount / 20))
  scores.efficiency = efficiency
  if (toolCallCount > 10) {
    feedback.push(`High tool usage (${toolCallCount} calls) - may be inefficient`)
  }

  // 4. OUTPUT QUALITY: Did it produce output?
  scores.output_quality = result.finalText.length >= 5 ? 1.0 : 0.0
  if (result.finalText.length === 0) {
    feedback.push('No text output generated')
  } else if (result.finalText.length < 5) {
    feedback.push(`Very short output (${result.finalText.length} chars)`)
  }

  // 5. ERROR HANDLING: How well did it handle errors?
  const errorRecovery = result.errors.length === 0 ? 1.0 : (
    result.exitCode === 0 ? 0.5 : 0.0
  )
  scores.error_handling = errorRecovery
  if (result.errors.length > 0 && result.exitCode === 0) {
    feedback.push('Recovered from tool errors')
  }

  // 6. METHODOLOGY: Did it follow good patterns?
  const methodologyScore = evaluateMethodology(result)
  scores.methodology = methodologyScore.score
  feedback.push(...methodologyScore.feedback)

  // Overall score (weighted average)
  const overall = (
    scores.success * 0.3 +
    scores.tool_usage * 0.2 +
    scores.efficiency * 0.15 +
    scores.output_quality * 0.15 +
    scores.error_handling * 0.1 +
    scores.methodology * 0.1
  )

  return {
    overall,
    scores,
    feedback,
    grade: getGrade(overall)
  }
}

function evaluateMethodology(result) {
  const feedback = []
  let score = 1.0

  // Check for Read-before-Edit pattern
  const tools = result.toolCalls.map(t => t.name)
  const hasEdit = tools.some(t => t === 'Edit' || t === 'Write')
  const hasRead = tools.some(t => t === 'Read' || t === 'Glob' || t === 'Grep')

  if (hasEdit && !hasRead) {
    feedback.push('⚠️ Modified files without reading first')
    score -= 0.3
  }

  // Check for multiple parallel searches
  const searchTools = result.toolCalls.filter(t =>
    t.name === 'Grep' || t.name === 'Glob'
  )
  if (searchTools.length > 5) {
    feedback.push('⚠️ Many sequential searches - could use Task tool')
    score -= 0.2
  }

  // Check for proper tool selection
  const bashSearches = result.toolCalls.filter(t =>
    t.name === 'Bash' && (
      t.input.command?.includes('grep') ||
      t.input.command?.includes('find')
    )
  )
  if (bashSearches.length > 0) {
    feedback.push('⚠️ Used Bash for search instead of dedicated tools')
    score -= 0.2
  }

  return { score: Math.max(0, score), feedback }
}

function getGrade(overall) {
  if (overall >= 0.9) return 'A'
  if (overall >= 0.8) return 'B'
  if (overall >= 0.7) return 'C'
  if (overall >= 0.6) return 'D'
  return 'F'
}

export function generateReport(result, judgment) {
  const lines = []

  lines.push('═══════════════════════════════════════')
  lines.push('📊 EVAL REPORT')
  lines.push('═══════════════════════════════════════')
  lines.push(`Eval ID: ${result.evalId}`)
  lines.push(`Prompt: ${result.prompt}`)
  lines.push(`Duration: ${result.duration}ms`)
  lines.push('')

  lines.push('SCORES:')
  lines.push(`  Overall: ${(judgment.overall * 100).toFixed(1)}% (Grade: ${judgment.grade})`)
  for (const [key, value] of Object.entries(judgment.scores)) {
    const bar = '█'.repeat(Math.round(value * 10)) + '░'.repeat(10 - Math.round(value * 10))
    lines.push(`  ${key.padEnd(18)}: ${bar} ${(value * 100).toFixed(1)}%`)
  }
  lines.push('')

  lines.push('FEEDBACK:')
  for (const item of judgment.feedback) {
    lines.push(`  • ${item}`)
  }
  lines.push('')

  lines.push('TOOL USAGE:')
  const toolStats = {}
  for (const call of result.toolCalls) {
    toolStats[call.name] = (toolStats[call.name] || 0) + 1
  }
  for (const [tool, count] of Object.entries(toolStats).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${tool}: ${count}x`)
  }

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('ERRORS:')
    for (const error of result.errors.slice(0, 3)) {
      lines.push(`  ✗ ${typeof error.error === 'string' ? error.error.substring(0, 100) : JSON.stringify(error.error).substring(0, 100)}`)
    }
  }

  lines.push('═══════════════════════════════════════')

  return lines.join('\n')
}
