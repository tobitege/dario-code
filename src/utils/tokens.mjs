/**
 * Token Estimation Utilities
 * Simple char/4 estimation — good enough for context % display.
 */

/**
 * Estimate token count for a string (~4 chars per token)
 */
export function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Get total context token usage
 */
export async function getTotalContextTokens(messages, tools) {
  let total = 0
  const est = estimateTokens

  try {
    // System prompt
    const { getSystemPromptIntro, getSystemInstructions } = await import('../prompts/system.mjs')
    const intro = getSystemPromptIntro()
    const instructions = await getSystemInstructions()
    total += est([intro, ...instructions].join('\n'))
  } catch {}

  // Tools
  for (const tool of (tools || [])) {
    const desc = typeof tool.description === 'string' ? tool.description : (tool.name || '')
    const schema = tool.inputSchema ? JSON.stringify(tool.inputSchema) : ''
    total += est(tool.name + desc + schema)
  }

  try {
    // Memory
    const { loadClaudeMd } = await import('../core/config.mjs')
    const claudeFiles = loadClaudeMd(process.cwd())
    for (const f of claudeFiles) {
      total += est(f.content)
    }
  } catch {}

  try {
    // Skills
    const { discoverSkills } = await import('../tools/skills-discovery.mjs')
    const skills = discoverSkills(process.cwd())
    for (const skill of skills.values()) {
      total += skill.tokenEstimate || 0
    }
  } catch {}

  // Conversation
  for (const msg of (messages || [])) {
    const content = msg.message?.content || msg.content
    const text = typeof content === 'string' ? content : JSON.stringify(content || '')
    total += est(text)
  }

  return total
}
