/**
 * MCP Manager Component
 *
 * Interactive TUI overlay for managing MCP servers.
 * Supports:
 * - Listing servers with connection status
 * - Adding new servers (stdio or SSE)
 * - Per-server actions (connect/disconnect/test/view tools/remove)
 * - Browsing available tools per server
 *
 * Pattern follows ModelSelector/AuthSelector overlays.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

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

const STATUS_ICONS = {
  connected: { icon: '●', color: THEME.success },
  failed: { icon: '✗', color: THEME.error },
  connecting: { icon: '◐', color: THEME.warning },
  disconnected: { icon: '○', color: THEME.secondaryText },
}

/**
 * Main MCP Manager overlay
 */
const STARTUP_MODE_CYCLE = ['always', 'ondemand', 'asneeded']
const STARTUP_MODE_LABELS = {
  always: 'always',
  ondemand: 'on demand',
  asneeded: 'as needed',
}
const STARTUP_MODE_HELP = {
  always: 'Connect on startup (async). Full tool schemas always available.',
  ondemand: 'Connect on first use. Cached schemas in prompt. Delay on first call.',
  asneeded: 'Smart mode. Summary in prompt, full schemas loaded when needed.',
}

export function McpManager({
  servers = {},
  clients = [],
  onAddServer,
  onRemoveServer,
  onConnectServer,
  onDisconnectServer,
  onTestServer,
  onSetStartupMode,
  onCancel,
  onMessage,
}) {
  // State machine: 'list' | 'add-type' | 'add-name' | 'add-command' | 'add-args' | 'add-url' | 'server-actions' | 'server-tools'
  const [view, setView] = useState('list')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedServer, setSelectedServer] = useState(null)
  const [serverTools, setServerTools] = useState([])
  const [toolScrollOffset, setToolScrollOffset] = useState(0)

  // Add server flow state
  const [newServerType, setNewServerType] = useState('stdio')
  const [newServerName, setNewServerName] = useState('')
  const [newServerCommand, setNewServerCommand] = useState('')
  const [newServerArgs, setNewServerArgs] = useState('')
  const [newServerUrl, setNewServerUrl] = useState('')
  const [inputFocused, setInputFocused] = useState(false)

  // Build items list for the main view
  const serverEntries = Object.entries(servers)
  const listItems = [
    ...serverEntries.map(([name, config]) => {
      const client = clients.find(c => c.name === name)
      const status = client?.type === 'connected' ? 'connected' : client?.type === 'failed' ? 'failed' : 'disconnected'
      return { type: 'server', name, config, status }
    }),
    { type: 'action', id: 'add', label: 'Add new server' },
  ]

  // Reset selection when switching views
  useEffect(() => {
    setSelectedIndex(0)
  }, [view])

  // Server action items
  const getServerActions = () => {
    if (!selectedServer) return []
    const client = clients.find(c => c.name === selectedServer)
    const isConnected = client?.type === 'connected'

    const actions = []
    if (isConnected) {
      actions.push({ id: 'disconnect', label: 'Disconnect' })
      actions.push({ id: 'tools', label: 'View tools' })
      actions.push({ id: 'test', label: 'Test connection' })
    } else {
      actions.push({ id: 'connect', label: 'Connect' })
    }
    actions.push({ id: 'remove', label: 'Remove server' })
    actions.push({ id: 'back', label: 'Back' })
    return actions
  }

  // Keyboard handling
  useInput((char, key) => {
    // Global escape
    if (key.escape) {
      if (view === 'list') {
        onCancel()
      } else if (view === 'server-tools') {
        setView('server-actions')
        setToolScrollOffset(0)
      } else if (view === 'server-actions') {
        setView('list')
        setSelectedServer(null)
      } else {
        // Cancel add flow
        setView('list')
        resetAddFlow()
      }
      return
    }

    // View-specific handling
    if (view === 'list') {
      handleListInput(char, key)
    } else if (view === 'add-type') {
      handleAddTypeInput(char, key)
    } else if (view === 'server-actions') {
      handleServerActionsInput(char, key)
    } else if (view === 'server-tools') {
      handleToolsInput(char, key)
    }
    // Text input views are handled by TextInput component
  }, { isActive: !inputFocused })

  const handleListInput = (char, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(listItems.length - 1, i + 1))
      return
    }
    // Space bar: cycle startup mode on selected server
    if (char === ' ') {
      const item = listItems[selectedIndex]
      if (item?.type === 'server') {
        const currentMode = item.config.startupMode || 'always'
        const idx = STARTUP_MODE_CYCLE.indexOf(currentMode)
        const nextMode = STARTUP_MODE_CYCLE[(idx + 1) % STARTUP_MODE_CYCLE.length]
        onSetStartupMode?.(item.name, nextMode)
      }
      return
    }
    if (key.return) {
      const item = listItems[selectedIndex]
      if (item.type === 'action' && item.id === 'add') {
        setView('add-type')
      } else if (item.type === 'server') {
        setSelectedServer(item.name)
        setView('server-actions')
      }
      return
    }
  }

  const handleAddTypeInput = (char, key) => {
    if (key.upArrow || key.downArrow) {
      setNewServerType(prev => prev === 'stdio' ? 'sse' : 'stdio')
      return
    }
    if (key.return) {
      setView('add-name')
      setInputFocused(true)
      return
    }
  }

  const handleServerActionsInput = (char, key) => {
    const actions = getServerActions()
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(actions.length - 1, i + 1))
      return
    }
    if (key.return) {
      const action = actions[selectedIndex]
      if (!action) return

      switch (action.id) {
        case 'connect':
          onConnectServer?.(selectedServer)
          onMessage?.(`Connecting to ${selectedServer}...`)
          setView('list')
          setSelectedServer(null)
          break
        case 'disconnect':
          onDisconnectServer?.(selectedServer)
          onMessage?.(`Disconnected from ${selectedServer}`)
          setView('list')
          setSelectedServer(null)
          break
        case 'tools':
          fetchServerTools()
          break
        case 'test':
          onTestServer?.(selectedServer)
          onMessage?.(`Testing ${selectedServer}...`)
          break
        case 'remove':
          onRemoveServer?.(selectedServer)
          onMessage?.(`Removed server ${selectedServer}`)
          setView('list')
          setSelectedServer(null)
          break
        case 'back':
          setView('list')
          setSelectedServer(null)
          break
      }
      return
    }
  }

  const handleToolsInput = (char, key) => {
    if (key.upArrow) {
      setToolScrollOffset(o => Math.max(0, o - 1))
      return
    }
    if (key.downArrow) {
      setToolScrollOffset(o => Math.min(Math.max(0, serverTools.length - 8), o + 1))
      return
    }
  }

  const resetAddFlow = () => {
    setNewServerType('stdio')
    setNewServerName('')
    setNewServerCommand('')
    setNewServerArgs('')
    setNewServerUrl('')
    setInputFocused(false)
  }

  const handleNameSubmit = (value) => {
    if (!value.trim()) return
    setNewServerName(value.trim())
    setInputFocused(false)

    if (newServerType === 'sse') {
      setView('add-url')
      setTimeout(() => setInputFocused(true), 50)
    } else {
      setView('add-command')
      setTimeout(() => setInputFocused(true), 50)
    }
  }

  const handleCommandSubmit = (value) => {
    if (!value.trim()) return
    setNewServerCommand(value.trim())
    setInputFocused(false)
    setView('add-args')
    setTimeout(() => setInputFocused(true), 50)
  }

  const handleArgsSubmit = (value) => {
    setInputFocused(false)
    const args = value.trim() ? value.trim().split(/\s+/) : []

    // Complete the add flow
    const config = {
      type: 'stdio',
      command: newServerCommand,
    }
    if (args.length > 0) config.args = args

    onAddServer?.(newServerName, config)
    onMessage?.(`Added MCP server "${newServerName}"`)
    resetAddFlow()
    setView('list')
  }

  const handleUrlSubmit = (value) => {
    if (!value.trim()) return
    setInputFocused(false)

    const config = {
      type: 'sse',
      url: value.trim(),
    }

    onAddServer?.(newServerName, config)
    onMessage?.(`Added MCP server "${newServerName}"`)
    resetAddFlow()
    setView('list')
  }

  const fetchServerTools = async () => {
    const client = clients.find(c => c.name === selectedServer && c.type === 'connected')
    if (!client?.client) {
      setServerTools([{ name: 'Error', description: 'Server not connected' }])
      setView('server-tools')
      return
    }

    try {
      // Use lenient schema — real servers may return tools with non-standard
      // inputSchema (e.g. anyOf unions) that the strict Zod schema rejects
      const result = await client.client.request(
        { method: 'tools/list' },
        { parse: (v) => v }
      )
      setServerTools(result.tools || [])
    } catch (err) {
      setServerTools([{ name: 'Error', description: err.message }])
    }
    setView('server-tools')
  }

  // Render current view
  const renderView = () => {
    switch (view) {
      case 'list': return renderList()
      case 'add-type': return renderAddType()
      case 'add-name': return renderAddName()
      case 'add-command': return renderAddCommand()
      case 'add-args': return renderAddArgs()
      case 'add-url': return renderAddUrl()
      case 'server-actions': return renderServerActions()
      case 'server-tools': return renderServerTools()
      default: return renderList()
    }
  }

  const renderList = () => {
    // Get selected item for mode help
    const selectedItem = listItems[selectedIndex]
    const selectedMode = selectedItem?.type === 'server'
      ? (selectedItem.config.startupMode || 'always')
      : null

    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude }, '⏺ MCP Servers'),
      serverEntries.length === 0
        ? React.createElement(Text, { key: 'empty', dimColor: true, marginTop: 1 }, '  No servers configured')
        : null,
      React.createElement(Box, { key: 'items', flexDirection: 'column', marginTop: 1 },
        listItems.map((item, idx) => {
          const isSelected = idx === selectedIndex

          if (item.type === 'server') {
            const si = STATUS_ICONS[item.status] || STATUS_ICONS.disconnected
            const mode = item.config.startupMode || 'always'
            return React.createElement(Box, { key: item.name, flexDirection: 'row' },
              React.createElement(Text, {
                color: isSelected ? THEME.suggestion : undefined,
                inverse: isSelected,
              },
                isSelected ? ' → ' : '   ',
                React.createElement(Text, { color: si.color }, si.icon),
                ' ',
                item.name
              ),
              React.createElement(Text, { dimColor: true },
                '  ',
                item.config.type === 'sse' ? item.config.url : item.config.command,
                item.config.args?.length ? ' ' + item.config.args.join(' ') : ''
              ),
              // Show mode suffix only on selected row
              isSelected
                ? React.createElement(Text, { color: THEME.secondaryText }, `  [${STARTUP_MODE_LABELS[mode]}]`)
                : null
            )
          }

          // Add action
          return React.createElement(Box, { key: item.id },
            React.createElement(Text, {
              color: isSelected ? THEME.suggestion : THEME.success,
              inverse: isSelected,
            }, isSelected ? ' → ' : '   ', '+ ', item.label)
          )
        })
      ),
      // Mode help text when a server is selected
      selectedMode
        ? React.createElement(Box, { key: 'mode-help', flexDirection: 'column', marginTop: 1 },
            React.createElement(Text, { dimColor: true, color: THEME.warning }, `  ${STARTUP_MODE_LABELS[selectedMode]}: ${STARTUP_MODE_HELP[selectedMode]}`)
          )
        : null,
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true },
          selectedMode
            ? '↑↓ Navigate · Space cycle mode · Enter actions · Esc close'
            : '↑↓ Navigate · Enter select · Esc close'
        )
      )
    )
  }

  const renderAddType = () => {
    const types = [
      { id: 'stdio', label: 'stdio', description: 'Run a local command (e.g., node server.js)' },
      { id: 'sse', label: 'SSE', description: 'Connect to an HTTP SSE endpoint' },
    ]

    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude }, '⏺ Add MCP Server'),
      React.createElement(Text, { key: 'subtitle', dimColor: true }, '  Select transport type:'),
      React.createElement(Box, { key: 'types', flexDirection: 'column', marginTop: 1 },
        types.map((t) => {
          const isSelected = t.id === newServerType
          return React.createElement(Box, { key: t.id, flexDirection: 'column', marginBottom: 1 },
            React.createElement(Text, {
              color: isSelected ? THEME.suggestion : undefined,
              inverse: isSelected,
            }, isSelected ? ' → ' : '   ', t.label),
            React.createElement(Text, { dimColor: true }, '     ', t.description)
          )
        })
      ),
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '↑↓ Select · Enter confirm · Esc back')
      )
    )
  }

  const renderAddName = () => {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude }, '⏺ Add MCP Server'),
      React.createElement(Text, { key: 'step', dimColor: true }, `  Type: ${newServerType}`),
      React.createElement(Box, { key: 'input', marginTop: 1 },
        React.createElement(Text, { color: THEME.suggestion }, '  Name: '),
        React.createElement(TextInput, {
          value: newServerName,
          onChange: setNewServerName,
          onSubmit: handleNameSubmit,
          placeholder: 'my-server',
          focus: true,
        })
      ),
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '  Enter to continue · Esc back')
      )
    )
  }

  const renderAddCommand = () => {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude }, '⏺ Add MCP Server'),
      React.createElement(Text, { key: 'step1', dimColor: true }, `  Type: ${newServerType}`),
      React.createElement(Text, { key: 'step2', dimColor: true }, `  Name: ${newServerName}`),
      React.createElement(Box, { key: 'input', marginTop: 1 },
        React.createElement(Text, { color: THEME.suggestion }, '  Command: '),
        React.createElement(TextInput, {
          value: newServerCommand,
          onChange: setNewServerCommand,
          onSubmit: handleCommandSubmit,
          placeholder: 'node',
          focus: true,
        })
      ),
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '  Enter to continue · Esc back')
      )
    )
  }

  const renderAddArgs = () => {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude }, '⏺ Add MCP Server'),
      React.createElement(Text, { key: 'step1', dimColor: true }, `  Type: ${newServerType}`),
      React.createElement(Text, { key: 'step2', dimColor: true }, `  Name: ${newServerName}`),
      React.createElement(Text, { key: 'step3', dimColor: true }, `  Command: ${newServerCommand}`),
      React.createElement(Box, { key: 'input', marginTop: 1 },
        React.createElement(Text, { color: THEME.suggestion }, '  Args: '),
        React.createElement(TextInput, {
          value: newServerArgs,
          onChange: setNewServerArgs,
          onSubmit: handleArgsSubmit,
          placeholder: 'server.js --port 3000 (optional, press Enter to skip)',
          focus: true,
        })
      ),
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '  Enter to save · Esc back')
      )
    )
  }

  const renderAddUrl = () => {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude }, '⏺ Add MCP Server'),
      React.createElement(Text, { key: 'step1', dimColor: true }, `  Type: ${newServerType}`),
      React.createElement(Text, { key: 'step2', dimColor: true }, `  Name: ${newServerName}`),
      React.createElement(Box, { key: 'input', marginTop: 1 },
        React.createElement(Text, { color: THEME.suggestion }, '  URL: '),
        React.createElement(TextInput, {
          value: newServerUrl,
          onChange: setNewServerUrl,
          onSubmit: handleUrlSubmit,
          placeholder: 'http://localhost:3000/sse',
          focus: true,
        })
      ),
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '  Enter to save · Esc back')
      )
    )
  }

  const renderServerActions = () => {
    const actions = getServerActions()
    const client = clients.find(c => c.name === selectedServer)
    const status = client?.type === 'connected' ? 'connected' : client?.type === 'failed' ? 'failed' : 'disconnected'
    const si = STATUS_ICONS[status]

    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude }, '⏺ Server: ', selectedServer),
      React.createElement(Box, { key: 'status', marginTop: 0 },
        React.createElement(Text, { dimColor: true }, '  Status: '),
        React.createElement(Text, { color: si.color }, si.icon, ' ', status)
      ),
      React.createElement(Box, { key: 'actions', flexDirection: 'column', marginTop: 1 },
        actions.map((action, idx) => {
          const isSelected = idx === selectedIndex
          let labelColor = undefined
          if (action.id === 'remove') labelColor = THEME.error
          if (action.id === 'connect') labelColor = THEME.success

          return React.createElement(Box, { key: action.id },
            React.createElement(Text, {
              color: isSelected ? THEME.suggestion : labelColor,
              inverse: isSelected,
            }, isSelected ? ' → ' : '   ', action.label)
          )
        })
      ),
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '↑↓ Navigate · Enter select · Esc back')
      )
    )
  }

  const renderServerTools = () => {
    const VISIBLE_TOOLS = 8
    const visibleTools = serverTools.slice(toolScrollOffset, toolScrollOffset + VISIBLE_TOOLS)
    const hasMore = serverTools.length > VISIBLE_TOOLS

    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { key: 'title', bold: true, color: THEME.claude },
        '⏺ Tools: ', selectedServer,
        React.createElement(Text, { dimColor: true }, ` (${serverTools.length})`)
      ),
      React.createElement(Box, { key: 'tools', flexDirection: 'column', marginTop: 1 },
        visibleTools.length === 0
          ? React.createElement(Text, { key: 'none', dimColor: true }, '  No tools available')
          : visibleTools.map((tool, idx) =>
              React.createElement(Box, {
                key: tool.name || idx,
                flexDirection: 'column',
                marginBottom: 1
              },
                React.createElement(Text, { color: THEME.suggestion }, '  ', tool.name),
                tool.description
                  ? React.createElement(Text, { dimColor: true }, '    ', tool.description.slice(0, 70))
                  : null
              )
            )
      ),
      hasMore ? React.createElement(Text, { key: 'scroll', dimColor: true },
        `  Showing ${toolScrollOffset + 1}-${Math.min(toolScrollOffset + VISIBLE_TOOLS, serverTools.length)} of ${serverTools.length}`
      ) : null,
      React.createElement(Box, { key: 'help', marginTop: 1 },
        React.createElement(Text, { dimColor: true }, '↑↓ Scroll · Esc back')
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

export default McpManager
