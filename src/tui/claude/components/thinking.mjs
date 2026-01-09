/**
 * Thinking Block Component
 *
 * Renders thinking blocks
 * - Collapsible/expandable
 * - Gray border
 * - Dimmed text
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { CLAUDE_COLORS, BOX_CHARS } from '../theme.mjs'

/**
 * Thinking block component
 */
export function ThinkingBlock({ content, id, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  // Handle keyboard toggle (optional - if focused)
  // useInput((input, key) => {
  //   if (key.return || input === ' ') {
  //     setCollapsed(!collapsed)
  //   }
  // })

  if (collapsed) {
    return React.createElement(Box, {
      borderStyle: 'round',
      borderColor: CLAUDE_COLORS.thinkingBorder,
      paddingX: 1,
      marginY: 1
    },
      React.createElement(Text, { dimColor: true }, '🤔 Thinking... (click to expand)')
    )
  }

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: CLAUDE_COLORS.thinkingBorder,
    paddingX: 1,
    marginY: 1
  },
    React.createElement(Box, null,
      React.createElement(Text, { dimColor: true, bold: true }, '🤔 Thinking')
    ),
    React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { dimColor: true }, content)
    )
  )
}

/**
 * Compact thinking indicator (for status line)
 */
export function ThinkingIndicator({ active = false }) {
  if (!active) return null

  return React.createElement(Box, null,
    React.createElement(Text, { dimColor: true }, '🤔 thinking...')
  )
}

export default {
  ThinkingBlock,
  ThinkingIndicator
}
