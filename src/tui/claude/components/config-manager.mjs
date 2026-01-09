/**
 * ConfigManager - Interactive configuration browser/editor overlay
 *
 * Allows browsing, editing, and removing config keys via arrow-key navigation.
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

export function ConfigManager({
  config = {},
  onSet,
  onRemove,
  onCancel,
  onMessage,
}) {
  const [view, setView] = useState('list') // list | edit | add
  const [entries, setEntries] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [newKey, setNewKey] = useState('')
  const [newKeyCursor, setNewKeyCursor] = useState(0)
  const [addStep, setAddStep] = useState('key') // key | value

  // Build entries list from config
  useEffect(() => {
    const items = Object.entries(config).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      rawValue: value,
    }))
    setEntries(items)
  }, [config])

  useInput((char, key) => {
    if (view === 'list') {
      if (key.escape) {
        onCancel()
        return
      }
      if (key.upArrow) {
        // Extra item at end for "Add new..."
        setSelectedIndex(i => Math.max(0, i - 1))
        return
      }
      if (key.downArrow) {
        setSelectedIndex(i => Math.min(entries.length, i + 1))
        return
      }
      if (key.return) {
        if (selectedIndex === entries.length) {
          // "Add new" option
          setView('add')
          setAddStep('key')
          setNewKey('')
          setNewKeyCursor(0)
          setEditValue('')
          setCursorOffset(0)
          return
        }
        const entry = entries[selectedIndex]
        if (entry) {
          setEditKey(entry.key)
          setEditValue(entry.value)
          setCursorOffset(entry.value.length)
          setView('edit')
        }
        return
      }
      // 'd' to delete
      if (char === 'd' && entries[selectedIndex]) {
        const entry = entries[selectedIndex]
        onRemove(entry.key)
        onMessage?.(`Removed config key: ${entry.key}`)
        if (selectedIndex >= entries.length - 1) {
          setSelectedIndex(Math.max(0, selectedIndex - 1))
        }
        return
      }
      return
    }

    if (view === 'edit') {
      if (key.escape) {
        setView('list')
        return
      }
      if (key.return) {
        // Save
        let parsedValue = editValue
        try {
          parsedValue = JSON.parse(editValue)
        } catch {
          // Keep as string
        }
        onSet(editKey, parsedValue)
        onMessage?.(`Set ${editKey} = ${editValue}`)
        setView('list')
        return
      }
      if (key.leftArrow) {
        setCursorOffset(o => Math.max(0, o - 1))
        return
      }
      if (key.rightArrow) {
        setCursorOffset(o => Math.min(editValue.length, o + 1))
        return
      }
      if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          setEditValue(v => v.slice(0, cursorOffset - 1) + v.slice(cursorOffset))
          setCursorOffset(o => o - 1)
        }
        return
      }
      if (char && !key.ctrl && !key.meta) {
        const code = char.charCodeAt(0)
        if (code < 32 && code !== 10) return
        setEditValue(v => v.slice(0, cursorOffset) + char + v.slice(cursorOffset))
        setCursorOffset(o => o + char.length)
      }
      return
    }

    if (view === 'add') {
      if (key.escape) {
        setView('list')
        return
      }
      if (addStep === 'key') {
        if (key.return) {
          if (newKey.trim()) {
            setAddStep('value')
            setEditValue('')
            setCursorOffset(0)
          }
          return
        }
        if (key.leftArrow) {
          setNewKeyCursor(o => Math.max(0, o - 1))
          return
        }
        if (key.rightArrow) {
          setNewKeyCursor(o => Math.min(newKey.length, o + 1))
          return
        }
        if (key.backspace || key.delete) {
          if (newKeyCursor > 0) {
            setNewKey(v => v.slice(0, newKeyCursor - 1) + v.slice(newKeyCursor))
            setNewKeyCursor(o => o - 1)
          }
          return
        }
        if (char && !key.ctrl && !key.meta) {
          const code = char.charCodeAt(0)
          if (code < 32) return
          setNewKey(v => v.slice(0, newKeyCursor) + char + v.slice(newKeyCursor))
          setNewKeyCursor(o => o + char.length)
        }
        return
      }
      if (addStep === 'value') {
        if (key.return) {
          let parsedValue = editValue
          try {
            parsedValue = JSON.parse(editValue)
          } catch {
            // Keep as string
          }
          onSet(newKey.trim(), parsedValue)
          onMessage?.(`Set ${newKey.trim()} = ${editValue}`)
          setView('list')
          return
        }
        if (key.leftArrow) {
          setCursorOffset(o => Math.max(0, o - 1))
          return
        }
        if (key.rightArrow) {
          setCursorOffset(o => Math.min(editValue.length, o + 1))
          return
        }
        if (key.backspace || key.delete) {
          if (cursorOffset > 0) {
            setEditValue(v => v.slice(0, cursorOffset - 1) + v.slice(cursorOffset))
            setCursorOffset(o => o - 1)
          }
          return
        }
        if (char && !key.ctrl && !key.meta) {
          const code = char.charCodeAt(0)
          if (code < 32 && code !== 10) return
          setEditValue(v => v.slice(0, cursorOffset) + char + v.slice(cursorOffset))
          setCursorOffset(o => o + char.length)
        }
        return
      }
    }
  })

  // Render text input with cursor
  const renderInput = (value, offset) => {
    const pos = Math.min(offset, value.length)
    const before = value.slice(0, pos)
    const at = value[pos] || ' '
    const after = value.slice(pos + 1)
    return React.createElement(Text, null,
      before,
      React.createElement(Text, { inverse: true }, at),
      after
    )
  }

  if (view === 'edit') {
    return React.createElement(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: THEME.claude,
      padding: 1,
      marginTop: 1,
    },
      React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Edit Configuration'),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, 'Key: '),
        React.createElement(Text, { bold: true }, editKey),
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, 'Value: '),
        renderInput(editValue, cursorOffset),
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, 'Enter to save · Escape to cancel'),
      )
    )
  }

  if (view === 'add') {
    return React.createElement(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: THEME.claude,
      padding: 1,
      marginTop: 1,
    },
      React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Add Configuration'),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, 'Key: '),
        addStep === 'key'
          ? renderInput(newKey, newKeyCursor)
          : React.createElement(Text, { bold: true }, newKey),
      ),
      addStep === 'value' && React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, 'Value: '),
        renderInput(editValue, cursorOffset),
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true },
          addStep === 'key' ? 'Enter to continue · Escape to cancel' : 'Enter to save · Escape to cancel'
        ),
      )
    )
  }

  // List view
  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: THEME.claude,
    padding: 1,
    marginTop: 1,
  },
    React.createElement(Text, { bold: true, color: THEME.claude }, '⏺ Configuration'),
    React.createElement(Text, { dimColor: true }, `${entries.length} setting${entries.length !== 1 ? 's' : ''}`),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      entries.length === 0
        ? React.createElement(Text, { dimColor: true }, '  No configuration values set')
        : entries.map((entry, idx) => {
            const isSelected = idx === selectedIndex
            const valueStr = entry.value.length > 50
              ? entry.value.slice(0, 50) + '...'
              : entry.value
            return React.createElement(Box, {
              key: entry.key,
              flexDirection: 'column',
              marginBottom: 0,
            },
              React.createElement(Text, {
                color: isSelected ? THEME.suggestion : undefined,
                inverse: isSelected,
              },
                isSelected ? ' → ' : '   ',
                entry.key
              ),
              React.createElement(Text, {
                dimColor: !isSelected,
                color: isSelected ? THEME.suggestion : undefined,
              }, '     ', valueStr)
            )
          }),
      // "Add new" option at the end
      React.createElement(Box, {
        key: 'add-new',
        marginTop: entries.length > 0 ? 1 : 0,
      },
        React.createElement(Text, {
          color: selectedIndex === entries.length ? THEME.success : THEME.secondaryText,
          inverse: selectedIndex === entries.length,
        },
          selectedIndex === entries.length ? ' → ' : '   ',
          '+ Add new setting'
        )
      )
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, '↑↓ Navigate · Enter to edit · d to delete · Escape to close')
    )
  )
}
