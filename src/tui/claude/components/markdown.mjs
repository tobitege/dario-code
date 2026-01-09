/**
 * Markdown Renderer for Terminal
 *
 * Renders markdown with syntax highlighting
 */

import { CLAUDE_COLORS, ANSI } from '../theme.mjs'
import { marked } from 'marked'
import chalk from 'chalk'

// Import our extracted terminal renderer
import { renderToTerminal } from '../../../terminal/renderer.mjs'

/**
 * Render markdown to terminal
 *
 * @param {string} content - Markdown content
 * @returns {string} ANSI-formatted terminal output
 */
export function renderMarkdown(content) {
  if (!content) return ''

  try {
    // Use our extracted terminal renderer
    return renderToTerminal(content)
  } catch (error) {
    // Fallback to basic rendering if terminal renderer fails
    return content
  }
}

/**
 * Render inline code
 */
export function renderInlineCode(code) {
  return `${ANSI.textSecondary}\`${code}\`${ANSI.reset}`
}

/**
 * Render code block with syntax highlighting
 */
export function renderCodeBlock(code, language = '') {
  // Add background and border
  const lines = code.split('\n')
  const rendered = lines
    .map(line => `  ${line}`)
    .join('\n')

  return `${ANSI.dim}${rendered}${ANSI.reset}`
}

/**
 * Render a link
 */
export function renderLink(text, url) {
  // Terminal hyperlink (OSC 8)
  return `\x1b]8;;${url}\x07${ANSI.info}${text}${ANSI.reset}\x1b]8;;\x07`
}

/**
 * Render bold text
 */
export function renderBold(text) {
  return `${ANSI.bold}${text}${ANSI.reset}`
}

/**
 * Render italic text
 */
export function renderItalic(text) {
  return `${ANSI.italic}${text}${ANSI.reset}`
}

/**
 * Render a list item
 */
export function renderListItem(text, ordered = false, index = 0) {
  const bullet = ordered ? `${index + 1}.` : '•'
  return `  ${ANSI.textSecondary}${bullet}${ANSI.reset} ${text}`
}

/**
 * Render a heading
 */
export function renderHeading(text, level = 1) {
  const styles = {
    1: (t) => `${ANSI.bold}${ANSI.claude}${t}${ANSI.reset}`,
    2: (t) => `${ANSI.bold}${t}${ANSI.reset}`,
    3: (t) => `${ANSI.bold}${t}${ANSI.reset}`
  }

  const style = styles[level] || styles[3]
  return style(text)
}

/**
 * Render a horizontal rule
 */
export function renderHR() {
  return `${ANSI.dim}${'─'.repeat(80)}${ANSI.reset}`
}

/**
 * Render a blockquote
 */
export function renderBlockquote(text) {
  const lines = text.split('\n')
  return lines
    .map(line => `${ANSI.textSecondary}│ ${ANSI.reset}${line}`)
    .join('\n')
}

export default {
  renderMarkdown,
  renderInlineCode,
  renderCodeBlock,
  renderLink,
  renderBold,
  renderItalic,
  renderListItem,
  renderHeading,
  renderHR,
  renderBlockquote
}
