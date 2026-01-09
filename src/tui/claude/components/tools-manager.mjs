/**
 * Tools Manager Component
 *
 * Interactive TUI overlay for browsing all tools and setting per-tool modes.
 * Each tool can be: off, always, ask, auto (similar to MCP startup modes).
 * Pattern follows McpManager overlay.
 */

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { TOOL_CATEGORIES } from '../../../tools/index.mjs'
import { loadSettings, saveSettings } from '../../../core/config.mjs'

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

const TOOL_MODES = ['always', 'ask', 'auto', 'off']
const TOOL_MODE_LABELS = {
  always: 'always',
  ask: 'ask',
  auto: 'auto',
  off: 'off',
}
const TOOL_MODE_HELP = {
  always: 'Tool is always available. No confirmation required.',
  ask: 'Prompt for confirmation before each use.',
  auto: 'Available when needed. Agent decides when to use it.',
  off: 'Tool is disabled and will not be offered to the model.',
}
const TOOL_MODE_COLORS = {
  always: THEME.success,
  ask: THEME.warning,
  auto: THEME.suggestion,
  off: THEME.error,
}

// Short static descriptions for built-in tools (description is async on tool objects)
const TOOL_DESCRIPTIONS = {
  Bash: 'Execute shell commands',
  Read: 'Read file contents',
  Edit: 'Edit files with string replacement',
  Write: 'Write new file contents',
  Glob: 'Find files by pattern',
  Grep: 'Search file contents with regex',
  MultiEdit: 'Multiple edits in one operation',
  Task: 'Spawn subagent for complex tasks',
  TaskCreate: 'Create a task in the task list',
  TaskGet: 'Get task details by ID',
  TaskUpdate: 'Update task status or details',
  TaskList: 'List all tasks',
  TodoWrite: 'Write todo items',
  TodoRead: 'Read todo items',
  WebFetch: 'Fetch and process web content',
  WebSearch: 'Search the web',
  NotebookEdit: 'Edit Jupyter notebook cells',
  AskUserQuestion: 'Ask the user a question',
  LSP: 'Language Server Protocol operations',
  EnterPlanMode: 'Enter planning mode',
  ExitPlanMode: 'Exit planning mode',
  Skill: 'Execute a skill/slash command',
}

// Friendly category labels
const CATEGORY_LABELS = {
  FILE_OPERATIONS: 'File Operations',
  AGENTS: 'Agents',
  TASK_MANAGEMENT: 'Task Management',
  WEB: 'Web',
  UI: 'User Interaction',
  NOTEBOOKS: 'Notebooks',
  COMMANDS: 'Commands',
  PLANNING: 'Planning',
  CODE_INTELLIGENCE: 'Code Intelligence',
}

/**
 * Load tool modes from settings
 */
function loadToolModes() {
  const settings = loadSettings()
  return settings.toolModes || {}
}

/**
 * Save a tool mode to settings
 */
function saveToolMode(toolName, mode) {
  const settings = loadSettings()
  if (!settings.toolModes) settings.toolModes = {}
  if (mode === 'always') {
    // 'always' is the default — remove from overrides
    delete settings.toolModes[toolName]
  } else {
    settings.toolModes[toolName] = mode
  }
  saveSettings(settings)
}

/**
 * Build a flat list of tools grouped by category
 */
function buildToolList(tools, toolModes) {
  const items = []
  const toolNames = new Set(tools.map(t => t.name))

  // Track which tools have been listed (to catch uncategorized ones)
  const listed = new Set()

  for (const [category, categoryTools] of Object.entries(TOOL_CATEGORIES)) {
    const categoryLabel = CATEGORY_LABELS[category] || category
    const validTools = categoryTools.filter(name => toolNames.has(name))
    if (validTools.length === 0) continue

    items.push({ type: 'header', id: `hdr_${category}`, label: categoryLabel })

    for (const name of validTools) {
      const tool = tools.find(t => t.name === name)
      const mode = toolModes[name] || 'always'
      items.push({
        type: 'tool',
        id: name,
        name,
        description: TOOL_DESCRIPTIONS[name] || '',
        mode,
      })
      listed.add(name)
    }
  }

  // Uncategorized tools (MCP tools, plugin tools, etc.)
  const uncategorized = tools.filter(t => !listed.has(t.name))
  if (uncategorized.length > 0) {
    items.push({ type: 'header', id: 'hdr_other', label: 'Other' })
    for (const tool of uncategorized) {
      const mode = toolModes[tool.name] || 'always'
      items.push({
        type: 'tool',
        id: tool.name,
        name: tool.name,
        description: TOOL_DESCRIPTIONS[tool.name] || '',
        mode,
      })
    }
  }

  return items
}

/**
 * @param {Object} props
 * @param {Array} props.tools - Array of tool objects with { name, description }
 * @param {Function} props.onCancel - Close the overlay
 * @param {Function} props.onMessage - Show a status message
 */
export function ToolsManager({ tools = [], onCancel, onMessage }) {
  const [toolModes, setToolModes] = useState(() => loadToolModes())
  const [selectedIndex, setSelectedIndex] = useState(0)

  const items = buildToolList(tools, toolModes)
  const selectableItems = items.filter(i => i.type === 'tool')

  // Find the currently selected tool item
  const selectedTool = selectableItems[selectedIndex] || null
  const selectedMode = selectedTool ? (toolModes[selectedTool.name] || 'always') : null

  useInput((char, key) => {
    if (key.escape) {
      onCancel()
      return
    }

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(i => Math.min(selectableItems.length - 1, i + 1))
      return
    }

    // Space or Enter — cycle mode
    if ((char === ' ' || key.return) && selectedTool) {
      const currentMode = toolModes[selectedTool.name] || 'always'
      const idx = TOOL_MODES.indexOf(currentMode)
      const nextMode = TOOL_MODES[(idx + 1) % TOOL_MODES.length]

      saveToolMode(selectedTool.name, nextMode)
      setToolModes(prev => {
        const next = { ...prev }
        if (nextMode === 'always') {
          delete next[selectedTool.name]
        } else {
          next[selectedTool.name] = nextMode
        }
        return next
      })
      onMessage?.(`${selectedTool.name}: ${TOOL_MODE_LABELS[nextMode]}`)
      return
    }
  })

  // ─── Render ───────────────────────────────────────────

  let selectableIdx = 0

  return React.createElement(Box, { flexDirection: 'column' },
    // Header
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { bold: true, color: THEME.claude }, ' Tools'),
      React.createElement(Text, { dimColor: true }, `  ${selectableItems.length} tools`),
    ),

    // Tool list
    React.createElement(Box, { flexDirection: 'column' },
      ...items.map((item) => {
        if (item.type === 'header') {
          return React.createElement(Box, { key: item.id, marginTop: 1 },
            React.createElement(Text, { dimColor: true, bold: true }, `  ${item.label}`)
          )
        }

        const myIdx = selectableIdx++
        const isSelected = myIdx === selectedIndex
        const mode = toolModes[item.name] || 'always'
        const modeColor = TOOL_MODE_COLORS[mode] || THEME.secondaryText
        const modeIcon = mode === 'off' ? '\u25CB' : '\u25CF'

        return React.createElement(Box, { key: item.id, flexDirection: 'row' },
          React.createElement(Text, {
            color: isSelected ? THEME.suggestion : undefined,
            inverse: isSelected,
          },
            isSelected ? ' \u276F ' : '   ',
            React.createElement(Text, { color: modeColor }, modeIcon),
            ' ',
            item.name,
          ),
          isSelected
            ? React.createElement(Text, { color: THEME.secondaryText }, `  [${TOOL_MODE_LABELS[mode]}]`)
            : null,
        )
      })
    ),

    // Mode help for selected tool
    selectedMode
      ? React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
          React.createElement(Text, { dimColor: true, color: TOOL_MODE_COLORS[selectedMode] },
            `  ${TOOL_MODE_LABELS[selectedMode]}: ${TOOL_MODE_HELP[selectedMode]}`
          ),
          selectedTool?.description
            ? React.createElement(Text, { dimColor: true }, `  ${selectedTool.description}`)
            : null,
        )
      : null,

    // Footer
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { dimColor: true },
        '\u2191\u2193 navigate \u00B7 Space/Enter cycle mode \u00B7 Esc close'
      )
    )
  )
}
