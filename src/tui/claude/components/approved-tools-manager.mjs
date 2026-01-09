/**
 * ApprovedToolsManager - Interactive tool permissions overlay
 *
 * Lists approved and denied tools with arrow-key navigation and removal.
 */

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'

const THEME = {
  claude: '#D97706',
  text: '#E5E5E5',
  secondaryText: '#6B7280',
  secondaryBorder: '#374151',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  suggestion: '#3B82F6',
}

export function ApprovedToolsManager({
  permissions = { allow: [], deny: [], ask: [] },
  onRemoveAllow,
  onRemoveDeny,
  onCancel,
  onMessage,
}) {
  const [tab, setTab] = useState('allow') // allow | deny
  const [selectedIndex, setSelectedIndex] = useState(0)

  const currentList = tab === 'allow'
    ? (permissions.allow || [])
    : (permissions.deny || [])

  // Clamp selection when switching tabs or after removal
  useEffect(() => {
    if (selectedIndex >= currentList.length) {
      setSelectedIndex(Math.max(0, currentList.length - 1))
    }
  }, [currentList.length, selectedIndex])

  useInput((char, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    // Tab to switch between allow/deny
    if (key.tab) {
      setTab(t => t === 'allow' ? 'deny' : 'allow')
      setSelectedIndex(0)
      return
    }

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(currentList.length - 1, i + 1))
      return
    }

    // Enter or 'd' to remove selected
    if ((key.return || char === 'd') && currentList.length > 0) {
      const tool = currentList[selectedIndex]
      if (tool) {
        if (tab === 'allow') {
          onRemoveAllow(tool)
          onMessage?.(`Removed approval for: ${tool}`)
        } else {
          onRemoveDeny(tool)
          onMessage?.(`Removed denial for: ${tool}`)
        }
      }
      return
    }
  })

  const allowCount = (permissions.allow || []).length
  const denyCount = (permissions.deny || []).length

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: THEME.claude,
    padding: 1,
    marginTop: 1,
  },
    React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Tool Permissions'),
    // Tabs
    React.createElement(Box, { marginTop: 1, gap: 2 },
      React.createElement(Text, {
        bold: tab === 'allow',
        color: tab === 'allow' ? THEME.success : THEME.secondaryText,
        underline: tab === 'allow',
      }, `✓ Allowed (${allowCount})`),
      React.createElement(Text, {
        bold: tab === 'deny',
        color: tab === 'deny' ? THEME.error : THEME.secondaryText,
        underline: tab === 'deny',
      }, `✗ Denied (${denyCount})`),
    ),
    // Tool list
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      currentList.length === 0
        ? React.createElement(Text, { dimColor: true },
            tab === 'allow'
              ? '  No approved tools'
              : '  No denied tools'
          )
        : currentList.map((tool, idx) => {
            const isSelected = idx === selectedIndex
            const icon = tab === 'allow' ? '✓' : '✗'
            const color = tab === 'allow' ? THEME.success : THEME.error
            return React.createElement(Text, {
              key: `${tab}-${idx}`,
              color: isSelected ? THEME.suggestion : undefined,
              inverse: isSelected,
            },
              isSelected ? ' → ' : '   ',
              React.createElement(Text, { color: isSelected ? THEME.suggestion : color }, icon, ' '),
              tool
            )
          })
    ),
    // Help
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { dimColor: true },
        '↑↓ Navigate · Tab switch list · Enter/d remove · Escape close'
      )
    )
  )
}
