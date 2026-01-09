/**
 * Status Line Component
 *
 * Top-right status bar
 * Shows: model, token usage, mode
 */

import React from 'react'
import { Box, Text } from 'ink'
import { CLAUDE_COLORS } from '../theme.mjs'

/**
 * Status line component (top right of screen)
 */
export function StatusLine({ model, tokenUsage, contextLimit, mode = 'normal', fastMode = false }) {
  const percentUsed = contextLimit ? ((tokenUsage / contextLimit) * 100).toFixed(0) : 0

  // Color based on usage
  const usageColor = percentUsed > 90
    ? CLAUDE_COLORS.error
    : percentUsed > 70
      ? CLAUDE_COLORS.warning
      : CLAUDE_COLORS.textSecondary

  const PENGUIN_COLOR = '#d4a574'

  return React.createElement(Box, { justifyContent: 'flex-end', paddingRight: 1 },
    React.createElement(Text, { dimColor: true },
      fastMode && React.createElement(Text, { color: PENGUIN_COLOR }, '↯ '),
      model && React.createElement(Text, null, `${getModelShortName(model)} • `),
      React.createElement(Text, { color: usageColor },
        `${formatNumber(tokenUsage)}/${formatNumber(contextLimit)} tokens (${percentUsed}%)`
      ),
      mode !== 'normal' && React.createElement(Text, null, ` • ${mode}`)
    )
  )
}

/**
 * Get short model name for display
 */
function getModelShortName(model) {
  const shortNames = {
    'claude-sonnet-4-6': 'Sonnet 4.6',
    'claude-opus-4-6': 'Opus 4.6',
    'claude-opus-4-5-20251101': 'Opus 4.5',
    'claude-opus-4-1-20250805': 'Opus 4.1',
    'claude-haiku-4-5-20251001': 'Haiku 4.5',
    'claude-sonnet-4-20250514': 'Sonnet 4',
    'claude-3-5-haiku-20241022': 'Haiku 3.5',
    'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
    'claude-3-7-sonnet-20250219': 'Sonnet 3.7',
    'claude-3-opus-20240229': 'Opus 3'
  }

  return shortNames[model] || model
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  if (!num) return '0'
  return num.toLocaleString()
}

/**
 * Minimal status indicator (for simple mode)
 */
export function StatusIndicator({ status, message }) {
  const colors = {
    idle: CLAUDE_COLORS.textSecondary,
    thinking: CLAUDE_COLORS.claude,
    tool_use: CLAUDE_COLORS.toolBorder,
    error: CLAUDE_COLORS.error,
    success: CLAUDE_COLORS.success
  }

  const symbols = {
    idle: '○',
    thinking: '◐',
    tool_use: '⚙',
    error: '✗',
    success: '●'
  }

  return React.createElement(Box, null,
    React.createElement(Text, { color: colors[status] },
      `${symbols[status]} ${message}`
    )
  )
}

export default {
  StatusLine,
  StatusIndicator
}
