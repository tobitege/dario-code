/**
 * ContextManager - Interactive context item toggle overlay
 *
 * Lets users enable/disable context items (system prompt, tools, MCP tools,
 * memory files, conversation) to test different configurations.
 * Also supports adding custom context from files, URLs, or doc searches.
 * Disabled items are persisted to settings and excluded from API calls.
 *
 * Views: list → add-type → add-input → (loading) → list
 */

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

const THEME = {
  claude: '#D97706',
  text: '#E5E5E5',
  secondaryText: '#6B7280',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  suggestion: '#3B82F6',
}

const ADD_TYPES = [
  { id: 'file', label: 'File', description: 'Add a local file as context', placeholder: '/path/to/file.md' },
  { id: 'url', label: 'URL', description: 'Fetch a URL and add its content', placeholder: 'https://docs.example.com/guide' },
  { id: 'docs', label: 'Docs search', description: 'Search library docs (via Context7)', placeholder: 'react hooks' },
  { id: 'text', label: 'Text note', description: 'Add freeform text as context', placeholder: 'Use snake_case for all variables...' },
]

export function ContextManager({
  contextItems = [],
  disabledItems = {},
  onToggle,
  onAdd,
  onRemove,
  onCancel,
  onMessage,
}) {
  // State machine: 'list' | 'add-type' | 'add-input' | 'loading' | 'confirm-remove'
  const [view, setView] = useState('list')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [addTypeIndex, setAddTypeIndex] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [removeTarget, setRemoveTarget] = useState(null)

  // Build list items: context items + "Add new..." action
  const listItems = [
    ...contextItems,
    { id: '__add__', label: 'Add new...', isAction: true },
  ]

  // Clamp selection when items change
  useEffect(() => {
    if (selectedIndex >= listItems.length) {
      setSelectedIndex(Math.max(0, listItems.length - 1))
    }
  }, [listItems.length])

  // Reset selection on view change
  useEffect(() => {
    if (view === 'list') {
      // Don't reset — keep position
    } else if (view === 'add-type') {
      setAddTypeIndex(0)
    }
  }, [view])

  useInput((char, key) => {
    if (view === 'loading') return // No input during loading

    // Escape — navigate back
    if (key.escape) {
      if (view === 'list') {
        onCancel()
      } else if (view === 'confirm-remove') {
        setView('list')
        setRemoveTarget(null)
      } else {
        setView('list')
        setInputValue('')
        setInputFocused(false)
      }
      return
    }

    if (view === 'list') {
      handleListInput(char, key)
    } else if (view === 'add-type') {
      handleAddTypeInput(char, key)
    } else if (view === 'confirm-remove') {
      handleConfirmRemoveInput(char, key)
    }
    // add-input is handled by TextInput
  }, { isActive: !inputFocused })

  // ── List view input ──
  const handleListInput = (char, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(listItems.length - 1, i + 1))
      return
    }

    const item = listItems[selectedIndex]

    // Space to toggle (not on action row)
    if (char === ' ' && item && !item.isAction && !item.locked) {
      onToggle(item.id)
      return
    }

    // Enter: action row → add flow, regular item → toggle
    if (key.return) {
      if (item?.isAction) {
        setView('add-type')
        return
      }
      if (item && !item.locked) {
        onToggle(item.id)
      }
      return
    }

    // 'd' or Delete to remove custom items
    if ((char === 'd' || key.delete) && item?.isCustom) {
      setRemoveTarget(item)
      setView('confirm-remove')
      return
    }
  }

  // ── Add type selection input ──
  const handleAddTypeInput = (char, key) => {
    if (key.upArrow) {
      setAddTypeIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setAddTypeIndex(i => Math.min(ADD_TYPES.length - 1, i + 1))
      return
    }
    if (key.return) {
      setInputValue('')
      setView('add-input')
      setInputFocused(true)
      return
    }
  }

  // ── Confirm remove input ──
  const handleConfirmRemoveInput = (char, key) => {
    if (char === 'y' || key.return) {
      if (removeTarget) {
        onRemove?.(removeTarget.id)
      }
      setRemoveTarget(null)
      setView('list')
      return
    }
    if (char === 'n' || key.escape) {
      setRemoveTarget(null)
      setView('list')
      return
    }
  }

  // ── Input submit handler ──
  const handleInputSubmit = (value) => {
    if (!value.trim()) return
    setInputFocused(false)
    setLoadingMessage('Adding context...')
    setView('loading')

    const addType = ADD_TYPES[addTypeIndex]
    onAdd?.(addType.id, value.trim())

    // Return to list after a brief pause (onAdd is async in parent)
    setTimeout(() => {
      setView('list')
      setInputValue('')
      setLoadingMessage('')
    }, 1500)
  }

  // ── Render views ──
  const renderView = () => {
    switch (view) {
      case 'list': return renderList()
      case 'add-type': return renderAddType()
      case 'add-input': return renderAddInput()
      case 'loading': return renderLoading()
      case 'confirm-remove': return renderConfirmRemove()
      default: return renderList()
    }
  }

  const renderList = () => {
    const enabledCount = contextItems.filter(i => !disabledItems[i.id]).length

    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { bold: true, color: THEME.claude },
        '⏺ Context Manager'
      ),
      React.createElement(Text, { dimColor: true },
        `${enabledCount}/${contextItems.length} items enabled`
      ),

      // Items list
      React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
        listItems.map((item, idx) => {
          const isSelected = idx === selectedIndex

          // "Add new..." action row
          if (item.isAction) {
            return React.createElement(Box, { key: item.id },
              React.createElement(Text, {
                color: isSelected ? THEME.suggestion : THEME.success,
                inverse: isSelected,
              }, isSelected ? ' → ' : '   ', '+ ', item.label)
            )
          }

          const isDisabled = !!disabledItems[item.id]
          const isLocked = !!item.locked
          const isCustom = !!item.isCustom
          const checkbox = isLocked ? '◆' : isDisabled ? '○' : '●'
          const checkColor = isLocked
            ? THEME.secondaryText
            : isDisabled ? THEME.error : THEME.success

          return React.createElement(Box, {
            key: item.id,
            flexDirection: 'row',
          },
            React.createElement(Text, {
              color: isSelected ? THEME.suggestion : undefined,
              inverse: isSelected,
            },
              isSelected ? ' → ' : '   ',
              React.createElement(Text, { color: isSelected ? THEME.suggestion : checkColor },
                checkbox, ' '
              ),
              React.createElement(Text, {
                color: isSelected
                  ? THEME.suggestion
                  : isDisabled ? THEME.secondaryText : undefined,
                strikethrough: isDisabled && !isLocked,
              },
                item.label
              ),
              item.tokens
                ? React.createElement(Text, { dimColor: true },
                    ` (~${item.tokens.toLocaleString()} tok)`
                  )
                : null,
              isLocked
                ? React.createElement(Text, { dimColor: true }, ' (required)')
                : null,
              isCustom
                ? React.createElement(Text, { dimColor: true }, ' [custom]')
                : null,
            )
          )
        })
      ),

      // Help
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true },
          '↑↓ Navigate · Space/Enter toggle · d remove custom · Esc close'
        )
      ),
      React.createElement(Box, {},
        React.createElement(Text, { dimColor: true },
          '● on  ○ off  ◆ required'
        )
      )
    )
  }

  const renderAddType = () => {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Add Context'),
      React.createElement(Text, { dimColor: true }, '  Select type:'),
      React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
        ADD_TYPES.map((t, idx) => {
          const isSelected = idx === addTypeIndex
          return React.createElement(Box, { key: t.id, flexDirection: 'column', marginBottom: 0 },
            React.createElement(Text, {
              color: isSelected ? THEME.suggestion : undefined,
              inverse: isSelected,
            }, isSelected ? ' → ' : '   ', t.label),
            React.createElement(Text, { dimColor: true }, '     ', t.description)
          )
        })
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '↑↓ Select · Enter confirm · Esc back')
      )
    )
  }

  const renderAddInput = () => {
    const addType = ADD_TYPES[addTypeIndex]
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Add Context'),
      React.createElement(Text, { dimColor: true }, `  Type: ${addType.label}`),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: THEME.suggestion },
          addType.id === 'file' ? '  Path: '
            : addType.id === 'url' ? '  URL: '
            : addType.id === 'docs' ? '  Search: '
            : '  Text: '
        ),
        React.createElement(TextInput, {
          value: inputValue,
          onChange: setInputValue,
          onSubmit: handleInputSubmit,
          placeholder: addType.placeholder,
          focus: true,
        })
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '  Enter to add · Esc back')
      )
    )
  }

  const renderLoading = () => {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Add Context'),
      React.createElement(Text, { color: THEME.warning, marginTop: 1 },
        `  ◐ ${loadingMessage}`
      )
    )
  }

  const renderConfirmRemove = () => {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Remove Context'),
      React.createElement(Text, { marginTop: 1 },
        '  Remove: ',
        React.createElement(Text, { color: THEME.error }, removeTarget?.label || '?')
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '  y confirm · n/Esc cancel')
      )
    )
  }

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: THEME.claude,
    padding: 1,
    marginTop: 1,
  }, renderView())
}
