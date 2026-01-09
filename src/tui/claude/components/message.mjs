/**
 * Message Component
 *
 * Renders user and assistant messages
 */

import React from 'react'
import { Box, Text } from 'ink'
import { CLAUDE_COLORS } from '../theme.mjs'
import { renderMarkdown } from './markdown.mjs'

/**
 * User message component
 */
export function UserMessage({ content }) {
  return React.createElement(Box, { flexDirection: 'column', marginBottom: 1 },
    React.createElement(Box, null,
      React.createElement(Text, { bold: true, color: CLAUDE_COLORS.textSecondary }, 'You')
    ),
    React.createElement(Box, { paddingLeft: 2 },
      React.createElement(Text, null, content)
    )
  )
}

/**
 * Assistant message component
 */
export function AssistantMessage({ content, isStreaming = false }) {
  return React.createElement(Box, { flexDirection: 'column', marginBottom: 1 },
    React.createElement(Box, null,
      React.createElement(Text, { bold: true, color: CLAUDE_COLORS.claude }, 'Claude'),
      isStreaming && React.createElement(Text, { dimColor: true }, ' (typing...)')
    ),
    React.createElement(Box, { paddingLeft: 2, flexDirection: 'column' },
      typeof content === 'string'
        ? React.createElement(MarkdownText, { content })
        : content.map((block, i) => React.createElement(ContentBlock, { key: i, block }))
    )
  )
}

/**
 * Render markdown text with syntax highlighting
 */
function MarkdownText({ content }) {
  // Use our terminal markdown renderer
  const rendered = renderMarkdown(content)
  return React.createElement(Text, null, rendered)
}

/**
 * Render a content block (text, tool_use, etc.)
 */
function ContentBlock({ block }) {
  if (block.type === 'text') {
    return React.createElement(MarkdownText, { content: block.text })
  }

  if (block.type === 'tool_use') {
    // Tool use blocks are handled by ToolUse component
    return null
  }

  if (block.type === 'tool_result') {
    // Tool results are handled by ToolResult component
    return null
  }

  // Unknown block type
  return React.createElement(Text, { dimColor: true },
    `[Unknown content type: ${block.type}]`
  )
}

/**
 * System message component (for errors, warnings, etc.)
 */
export function SystemMessage({ content, type = 'info' }) {
  const colors = {
    info: CLAUDE_COLORS.info,
    success: CLAUDE_COLORS.success,
    error: CLAUDE_COLORS.error,
    warning: CLAUDE_COLORS.warning
  }

  const symbols = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    warning: '⚠'
  }

  return React.createElement(Box, { marginBottom: 1 },
    React.createElement(Text, { color: colors[type] },
      `${symbols[type]} ${content}`
    )
  )
}

export default {
  UserMessage,
  AssistantMessage,
  SystemMessage
}
