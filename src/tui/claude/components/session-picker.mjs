/**
 * SessionPicker - Interactive session resume overlay
 *
 * Session resume UI:
 *   - First prompt as session label
 *   - Relative timestamps + git branch + file size
 *   - Ctrl+A to show all projects
 *   - Ctrl+B to toggle branch display
 *   - Ctrl+V to preview session
 *   - Ctrl+R to rename session
 *   - Type to search
 *   - Esc to cancel
 */

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { SourceBadge } from './source-badge.mjs'

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

/**
 * Format bytes to human-readable size (matches real CC: "7.4 MB", "23.7 KB")
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function SessionPicker({
  sessions = [],
  allSessions = null, // sessions from all projects (loaded on Ctrl+A)
  onSelect,
  onCancel,
  onMessage,
  onLoadAllProjects,
  onPreview,
  onRename,
  isLoading = false,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [showBranch, setShowBranch] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameText, setRenameText] = useState('')
  const [previewSession, setPreviewSession] = useState(null)

  const currentSessions = showAllProjects && allSessions ? allSessions : sessions

  // Filter by search query
  const filtered = searchQuery
    ? currentSessions.filter(s => {
        const q = searchQuery.toLowerCase()
        return (
          (s.firstPrompt || '').toLowerCase().includes(q) ||
          (s.name || '').toLowerCase().includes(q) ||
          (s.id || '').toLowerCase().includes(q) ||
          (s.gitBranch || '').toLowerCase().includes(q)
        )
      })
    : currentSessions

  // Clamp selection
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, selectedIndex])

  useInput((char, key) => {
    if (isLoading) return

    // Preview mode: any key closes it
    if (previewSession) {
      setPreviewSession(null)
      return
    }

    // Rename mode: handle text entry
    if (renaming) {
      if (key.escape) {
        setRenaming(false)
        setRenameText('')
        return
      }
      if (key.return) {
        if (renameText.trim() && onRename) {
          const session = filtered[selectedIndex]
          if (session) onRename(session, renameText.trim())
        }
        setRenaming(false)
        setRenameText('')
        return
      }
      if (key.backspace || key.delete) {
        setRenameText(t => t.slice(0, -1))
        return
      }
      if (char && !key.ctrl && !key.meta && char.length === 1 && char >= ' ') {
        setRenameText(t => t + char)
        return
      }
      return
    }

    if (key.escape) {
      if (searchQuery) {
        setSearchQuery('')
        return
      }
      onCancel()
      return
    }
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(filtered.length - 1, i + 1))
      return
    }
    if (key.return && filtered.length > 0) {
      const session = filtered[selectedIndex]
      if (session) onSelect(session)
      return
    }

    // Ctrl+A — show all projects
    if (key.ctrl && char === 'a') {
      if (!showAllProjects && onLoadAllProjects) {
        onLoadAllProjects()
      }
      setShowAllProjects(prev => !prev)
      setSelectedIndex(0)
      return
    }

    // Ctrl+B — toggle branch display
    if (key.ctrl && char === 'b') {
      setShowBranch(prev => !prev)
      return
    }

    // Ctrl+V — preview selected session
    if (key.ctrl && char === 'v') {
      if (filtered.length > 0) {
        const session = filtered[selectedIndex]
        if (session) {
          if (onPreview) {
            onPreview(session)
          }
          setPreviewSession(session)
        }
      }
      return
    }

    // Ctrl+R — rename selected session
    if (key.ctrl && char === 'r') {
      if (filtered.length > 0) {
        const session = filtered[selectedIndex]
        if (session) {
          setRenaming(true)
          setRenameText(session.firstPrompt?.slice(0, 70) || session.name || '')
        }
      }
      return
    }

    // Backspace — remove last search char
    if (key.backspace || key.delete) {
      setSearchQuery(q => q.slice(0, -1))
      setSelectedIndex(0)
      return
    }

    // Printable character — add to search
    if (char && !key.ctrl && !key.meta && char.length === 1 && char >= ' ') {
      setSearchQuery(q => q + char)
      setSelectedIndex(0)
      return
    }
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffSec = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffSec < 5) return 'Just now'
    if (diffSec < 60) return `${diffSec} seconds ago`
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return d.toLocaleDateString()
  }

  const title = showAllProjects ? 'Resume Session (All Projects)' : 'Resume Session'

  // Preview overlay
  if (previewSession) {
    const msgs = previewSession.messages || []
    const previewCount = Math.min(msgs.length, 6)
    return React.createElement(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: THEME.claude,
      padding: 1,
      marginTop: 1,
    },
      React.createElement(Text, { bold: true, color: THEME.claude },
        `Preview: ${previewSession.firstPrompt?.slice(0, 50) || previewSession.name || 'Session'}`
      ),
      React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
        previewCount === 0
          ? React.createElement(Text, { dimColor: true }, '(no messages)')
          : msgs.slice(0, previewCount).map((msg, i) =>
              React.createElement(Box, { key: i, marginBottom: 0 },
                React.createElement(Text, {
                  color: msg.role === 'user' ? THEME.suggestion : THEME.text,
                  bold: msg.role === 'user',
                },
                  msg.role === 'user' ? 'You: ' : 'AI: ',
                  (typeof msg.content === 'string' ? msg.content : '').slice(0, 80),
                  msg.content?.length > 80 ? '...' : '',
                )
              )
            ),
        msgs.length > previewCount
          ? React.createElement(Text, { dimColor: true, marginTop: 1 },
              `... ${msgs.length - previewCount} more messages`
            )
          : null,
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, 'Press any key to close preview')
      )
    )
  }

  // Rename input overlay
  if (renaming) {
    return React.createElement(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: THEME.warning,
      padding: 1,
      marginTop: 1,
    },
      React.createElement(Text, { bold: true, color: THEME.warning }, 'Rename Session'),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: THEME.text }, `New name: ${renameText}`,
          React.createElement(Text, { dimColor: true }, '█')
        )
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { dimColor: true }, 'Enter to save · Esc to cancel')
      )
    )
  }

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: THEME.claude,
    padding: 1,
    marginTop: 1,
  },
    React.createElement(Text, { bold: true, color: THEME.claude }, `\u23FA ${title}`),

    // Search indicator
    searchQuery
      ? React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { color: THEME.suggestion }, `Search: ${searchQuery}`,
            React.createElement(Text, { dimColor: true }, '\u2588')
          )
        )
      : null,

    isLoading
      ? React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { dimColor: true }, 'Loading sessions...')
        )
      : filtered.length === 0
        ? React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
            React.createElement(Text, { dimColor: true },
              searchQuery
                ? `No sessions matching "${searchQuery}"`
                : 'No previous sessions found'
            ),
            !searchQuery
              ? React.createElement(Text, { dimColor: true, marginTop: 1 },
                  'Sessions are saved automatically when you use the CLI.'
                )
              : null,
          )
        : React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
            React.createElement(Box, { marginTop: 0, flexDirection: 'column' },
              filtered.map((session, idx) => {
                const isSelected = idx === selectedIndex
                const prompt = session.firstPrompt?.slice(0, 70) || session.name || session.id?.slice(0, 8) || `Session ${idx + 1}`
                const time = formatDate(session.updated || session.created)
                const branch = showBranch && session.gitBranch ? ` \u00B7 ${session.gitBranch}` : ''
                const size = session.fileSize ? ` \u00B7 ${formatFileSize(session.fileSize)}` : ''
                const project = showAllProjects && session.cwd
                  ? ` \u00B7 ${session.cwd.split('/').slice(-2).join('/')}`
                  : ''

                return React.createElement(Box, {
                  key: session.id || idx,
                  flexDirection: 'column',
                  marginBottom: 0,
                },
                  React.createElement(Box, { flexDirection: 'row' },
                    React.createElement(Text, {
                      color: isSelected ? THEME.suggestion : undefined,
                      inverse: isSelected,
                    },
                      isSelected ? ' \u276F ' : '   ',
                      prompt,
                    ),
                    session.source ? React.createElement(SourceBadge, { source: session.source, dim: !isSelected }) : null,
                  ),
                  React.createElement(Text, {
                    dimColor: !isSelected,
                    color: isSelected ? THEME.suggestion : undefined,
                  },
                    '     ',
                    time,
                    branch,
                    size,
                    project,
                  )
                )
              })
            )
          ),

    // Controls footer
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      filtered.length > 0
        ? React.createElement(Text, { dimColor: true },
            'Ctrl+A ',
            showAllProjects
              ? 'show current project'
              : 'show all projects',
            ' \u00B7 Ctrl+B ',
            showBranch ? 'hide' : 'show',
            ' branch \u00B7 Ctrl+V preview \u00B7 Ctrl+R rename',
          )
        : null,
      React.createElement(Text, { dimColor: true },
        filtered.length > 0
          ? 'Type to search \u00B7 Esc to ' + (searchQuery ? 'clear' : 'cancel')
          : 'Esc to close'
      )
    )
  )
}
