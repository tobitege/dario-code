/**
 * Tool Use Component
 *
 * Renders tool use cards
 * - Colored border (claude tan/orange)
 * - Tool name and input
 * - Status indicators
 * - Result display
 */

import React from 'react'
import { Box, Text } from 'ink'
import { CLAUDE_COLORS, BOX_CHARS } from '../theme.mjs'

/**
 * Tool use card - shown when Claude uses a tool
 */
export function ToolUseCard({ toolName, input, status = 'running', result = null, isError = false }) {
  const borderColor = isError ? CLAUDE_COLORS.error : CLAUDE_COLORS.toolBorder
  const statusSymbol = {
    running: '◐',
    success: '●',
    error: '✗'
  }[status] || '○'

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: borderColor,
    paddingX: 1,
    marginY: 1
  },
    React.createElement(Box, { justifyContent: 'space-between' },
      React.createElement(Box, null,
        React.createElement(Text, { color: CLAUDE_COLORS.claude, bold: true }, `⚙ ${toolName}`)
      ),
      React.createElement(Box, null,
        React.createElement(Text, { color: borderColor }, statusSymbol)
      )
    ),
    input && Object.keys(input).length > 0 && React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { dimColor: true }, 'Input:'),
      React.createElement(Box, { paddingLeft: 2 },
        React.createElement(Text, null, formatInput(input))
      )
    ),
    result && React.createElement(Box, {
      flexDirection: 'column',
      marginTop: 1,
      paddingTop: 1,
      borderTop: true,
      borderColor: borderColor
    },
      React.createElement(Text, { dimColor: true }, 'Result:'),
      React.createElement(Box, { paddingLeft: 2 },
        React.createElement(Text, { color: isError ? CLAUDE_COLORS.error : undefined },
          formatResult(result)
        )
      )
    )
  )
}

/**
 * Format tool input for display
 */
function formatInput(input) {
  if (typeof input === 'string') {
    return input.length > 100 ? input.substring(0, 100) + '…' : input
  }

  const entries = Object.entries(input)
  if (entries.length === 0) return '{}'
  if (entries.length === 1) {
    const [key, value] = entries[0]
    return `${key}: ${formatValue(value)}`
  }

  // Multiple entries - show count
  return `${entries.length} parameters`
}

/**
 * Format tool result for display
 */
function formatResult(result) {
  if (typeof result === 'string') {
    // Truncate long results
    const maxLength = 500
    if (result.length > maxLength) {
      return result.substring(0, maxLength) + `\n\n... (${result.length - maxLength} more characters)`
    }
    return result
  }

  if (Array.isArray(result)) {
    return `${result.length} items`
  }

  return JSON.stringify(result, null, 2)
}

/**
 * Format a value for display
 */
function formatValue(value) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') {
    return value.length > 50 ? `"${value.substring(0, 50)}…"` : `"${value}"`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`
  }
  if (typeof value === 'object') {
    return `{${Object.keys(value).length} keys}`
  }
  return String(value)
}

/**
 * Compact tool use display (for collapsed view)
 */
export function ToolUseCompact({ toolName, status = 'running' }) {
  const statusSymbol = {
    running: '◐',
    success: '●',
    error: '✗'
  }[status] || '○'

  return React.createElement(Box, null,
    React.createElement(Text, { dimColor: true },
      `${statusSymbol} ${toolName}`
    )
  )
}

export default {
  ToolUseCard,
  ToolUseCompact
}
