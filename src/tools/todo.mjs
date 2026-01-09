/**
 * Task Management Tools - TaskCreate, TaskGet, TaskUpdate, TaskList
 *
 * Replaces the old TodoWrite/TodoRead with compatible
 * individual task management tools with dependencies and ownership.
 */

import { z } from 'zod'

// In-memory task storage
let tasks = []
let nextId = 1
let taskListeners = []

// ============================================================================
// TaskCreate
// ============================================================================

export const taskCreateInputSchema = z.object({
  subject: z.string().describe('Brief title for the task'),
  description: z.string().describe('Detailed description of what needs to be done'),
  activeForm: z.string().optional().describe('Present continuous form shown when in_progress (e.g., "Running tests")'),
})

export const TASK_CREATE_PROMPT = `Create a new task in the task list for tracking progress during coding sessions.

When to use:
- Complex multi-step tasks (3+ steps)
- User provides multiple tasks
- After receiving new instructions
- When identifying additional work during implementation

Task fields:
- subject: Brief, actionable title in imperative form (e.g., "Fix authentication bug")
- description: Detailed description with context and acceptance criteria
- activeForm: Present continuous form for spinner (e.g., "Fixing authentication bug")

All tasks start with status 'pending'.`

export function createTaskCreateTool(dependencies = {}) {
  const { React = null, onUpdate = null } = dependencies
  return {
    name: 'TaskCreate',
    async description() { return 'Create a new task in the task list' },
    userFacingName() { return 'TaskCreate' },
    inputSchema: taskCreateInputSchema,
    async isEnabled() { return true },
    isReadOnly() { return false },
    needsPermissions() { return false },
    async prompt() { return TASK_CREATE_PROMPT },
    renderToolUseMessage({ subject } = {}) { return `Creating task: ${subject}` },
    renderToolUseRejectedMessage() { return React ? React.createElement('span', { style: { color: 'red' } }, 'Task creation rejected') : null },
    renderToolResultMessage(result) { return React ? React.createElement('span', null, `  ⎿  Task created`) : null },
    async *call({ subject, description, activeForm }, context) {
      const task = {
        id: String(nextId++),
        subject,
        description,
        activeForm: activeForm || subject,
        status: 'pending',
        owner: null,
        blocks: [],
        blockedBy: [],
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      tasks.push(task)
      notifyListeners()
      if (onUpdate) onUpdate(tasks)
      yield {
        type: 'result',
        data: task,
        resultForAssistant: `Task #${task.id} created successfully: ${subject}`,
      }
    },
    renderResultForAssistant(result) { return result?.resultForAssistant || 'Task created' }
  }
}

// ============================================================================
// TaskGet
// ============================================================================

export const taskGetInputSchema = z.object({
  taskId: z.string().describe('The ID of the task to retrieve'),
})

export function createTaskGetTool(dependencies = {}) {
  const { React = null } = dependencies
  return {
    name: 'TaskGet',
    async description() { return 'Retrieve a task by ID with full details' },
    userFacingName() { return 'TaskGet' },
    inputSchema: taskGetInputSchema,
    async isEnabled() { return true },
    isReadOnly() { return true },
    needsPermissions() { return false },
    async prompt() { return 'Retrieve a task by its ID to see full details including description and dependencies.' },
    renderToolUseMessage({ taskId } = {}) { return `Getting task #${taskId}` },
    renderToolUseRejectedMessage() { return null },
    renderToolResultMessage() { return React ? React.createElement('span', null, '  ⎿  Task retrieved') : null },
    async *call({ taskId }, context) {
      const task = tasks.find(t => t.id === taskId)
      if (!task) {
        yield { type: 'result', data: null, resultForAssistant: `Task #${taskId} not found` }
        return
      }
      const openBlockedBy = task.blockedBy.filter(id => {
        const blocker = tasks.find(t => t.id === id)
        return blocker && blocker.status !== 'completed'
      })
      yield {
        type: 'result',
        data: task,
        resultForAssistant: formatTaskDetail(task, openBlockedBy),
      }
    },
    renderResultForAssistant(result) { return result?.resultForAssistant || '' }
  }
}

// ============================================================================
// TaskUpdate
// ============================================================================

export const taskUpdateInputSchema = z.object({
  taskId: z.string().describe('The ID of the task to update'),
  status: z.enum(['pending', 'in_progress', 'completed', 'deleted']).optional().describe('New status'),
  subject: z.string().optional().describe('New subject'),
  description: z.string().optional().describe('New description'),
  activeForm: z.string().optional().describe('New active form text'),
  owner: z.string().optional().describe('Task owner (agent name)'),
  addBlocks: z.array(z.string()).optional().describe('Task IDs this task blocks'),
  addBlockedBy: z.array(z.string()).optional().describe('Task IDs that block this task'),
})

export function createTaskUpdateTool(dependencies = {}) {
  const { React = null, onUpdate = null } = dependencies
  return {
    name: 'TaskUpdate',
    async description() { return 'Update a task status, subject, owner, or dependencies' },
    userFacingName() { return 'TaskUpdate' },
    inputSchema: taskUpdateInputSchema,
    async isEnabled() { return true },
    isReadOnly() { return false },
    needsPermissions() { return false },
    async prompt() { return 'Update task status, details, or dependencies. Use status "deleted" to permanently remove a task.' },
    renderToolUseMessage({ taskId, status } = {}) { return `Updating task #${taskId}${status ? ` → ${status}` : ''}` },
    renderToolUseRejectedMessage() { return null },
    renderToolResultMessage() { return React ? React.createElement('span', null, '  ⎿  Task updated') : null },
    async *call({ taskId, status, subject, description, activeForm, owner, addBlocks, addBlockedBy }, context) {
      const task = tasks.find(t => t.id === taskId)
      if (!task) {
        yield { type: 'result', data: null, resultForAssistant: `Task #${taskId} not found` }
        return
      }

      if (status === 'deleted') {
        tasks = tasks.filter(t => t.id !== taskId)
        // Remove from other tasks' blocks/blockedBy
        for (const t of tasks) {
          t.blocks = t.blocks.filter(id => id !== taskId)
          t.blockedBy = t.blockedBy.filter(id => id !== taskId)
        }
        notifyListeners()
        if (onUpdate) onUpdate(tasks)
        yield { type: 'result', data: null, resultForAssistant: `Task #${taskId} deleted` }
        return
      }

      if (status) task.status = status
      if (subject) task.subject = subject
      if (description) task.description = description
      if (activeForm) task.activeForm = activeForm
      if (owner !== undefined) task.owner = owner
      if (addBlocks) {
        for (const id of addBlocks) {
          if (!task.blocks.includes(id)) task.blocks.push(id)
          const blocked = tasks.find(t => t.id === id)
          if (blocked && !blocked.blockedBy.includes(taskId)) blocked.blockedBy.push(taskId)
        }
      }
      if (addBlockedBy) {
        for (const id of addBlockedBy) {
          if (!task.blockedBy.includes(id)) task.blockedBy.push(id)
          const blocker = tasks.find(t => t.id === id)
          if (blocker && !blocker.blocks.includes(taskId)) blocker.blocks.push(taskId)
        }
      }
      task.updatedAt = Date.now()

      const updates = []
      if (status) updates.push(`status`)
      if (subject) updates.push(`subject`)
      if (owner !== undefined) updates.push(`owner`)
      if (addBlocks) updates.push(`blocks`)
      if (addBlockedBy) updates.push(`blockedBy`)
      notifyListeners()
      if (onUpdate) onUpdate(tasks)
      yield {
        type: 'result',
        data: task,
        resultForAssistant: `Updated task #${taskId} ${updates.join(', ')}`,
      }
    },
    renderResultForAssistant(result) { return result?.resultForAssistant || 'Task updated' }
  }
}

// ============================================================================
// TaskList
// ============================================================================

export const taskListInputSchema = z.object({})

export function createTaskListTool(dependencies = {}) {
  const { React = null } = dependencies
  return {
    name: 'TaskList',
    async description() { return 'List all tasks with summary' },
    userFacingName() { return 'TaskList' },
    inputSchema: taskListInputSchema,
    async isEnabled() { return true },
    isReadOnly() { return true },
    needsPermissions() { return false },
    async prompt() { return 'List all tasks showing id, subject, status, owner, and blockedBy.' },
    renderToolUseMessage() { return 'Listing tasks' },
    renderToolUseRejectedMessage() { return null },
    renderToolResultMessage() { return React ? React.createElement('span', null, `  ⎿  ${tasks.length} tasks`) : null },
    async *call(input, context) {
      const activeTasks = tasks.filter(t => t.status !== 'deleted')
      yield {
        type: 'result',
        data: { tasks: activeTasks },
        resultForAssistant: formatTaskList(activeTasks),
      }
    },
    renderResultForAssistant(result) { return result?.resultForAssistant || 'No tasks' }
  }
}

// ============================================================================
// Backwards-compatible aliases (TodoWrite/TodoRead)
// ============================================================================

export const todoWriteInputSchema = z.object({
  todos: z.array(z.object({
    content: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed']),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    id: z.string().optional(),
  }))
})

export const todoReadInputSchema = z.object({})
export const TODO_WRITE_PROMPT = TASK_CREATE_PROMPT

export function createTodoWriteTool(dependencies = {}) {
  // Delegate to TaskCreate-style behavior
  return createTaskCreateTool(dependencies)
}

export function createTodoReadTool(dependencies = {}) {
  // Delegate to TaskList-style behavior
  return createTaskListTool(dependencies)
}

// ============================================================================
// Helpers
// ============================================================================

function formatTaskDetail(task, openBlockedBy) {
  const lines = [
    `#${task.id}. [${task.status}] ${task.subject}`,
    `Description: ${task.description}`,
  ]
  if (task.owner) lines.push(`Owner: ${task.owner}`)
  if (task.blocks.length) lines.push(`Blocks: ${task.blocks.map(id => `#${id}`).join(', ')}`)
  if (openBlockedBy.length) lines.push(`Blocked by (open): ${openBlockedBy.map(id => `#${id}`).join(', ')}`)
  return lines.join('\n')
}

function formatTaskList(activeTasks) {
  if (activeTasks.length === 0) return 'No tasks.'
  return activeTasks.map(t => {
    const openBlockedBy = t.blockedBy.filter(id => {
      const blocker = tasks.find(bt => bt.id === id)
      return blocker && blocker.status !== 'completed'
    })
    let line = `#${t.id}. [${t.status}] ${t.subject}`
    if (t.owner) line += ` (owner: ${t.owner})`
    if (openBlockedBy.length) line += ` [blocked by ${openBlockedBy.map(id => `#${id}`).join(', ')}]`
    return line
  }).join('\n')
}

function notifyListeners() {
  taskListeners.forEach(listener => listener(tasks))
}

// ============================================================================
// Public API
// ============================================================================

export function getTodos() { return [...tasks] }
export function subscribeTodos(listener) {
  taskListeners.push(listener)
  return () => { taskListeners = taskListeners.filter(l => l !== listener) }
}
export function clearTodos() {
  tasks = []
  nextId = 1
  notifyListeners()
}

export default {
  createTaskCreateTool,
  createTaskGetTool,
  createTaskUpdateTool,
  createTaskListTool,
  createTodoWriteTool,
  createTodoReadTool,
  getTodos,
  subscribeTodos,
  clearTodos,
  todoWriteInputSchema,
  todoReadInputSchema,
  TODO_WRITE_PROMPT,
}
