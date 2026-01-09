/**
 * Background Task Management System
 *
 * Handles spawning, managing, and monitoring long-running background tasks.
 * Tasks run with independent processes and their output is buffered for retrieval.
 */

import { spawn } from 'child_process'
import { EventEmitter } from 'events'

// Maximum number of output lines to buffer per task
const MAX_OUTPUT_LINES = 10000

// Maximum output size in bytes before trimming oldest lines
const MAX_OUTPUT_SIZE = 5242880 // 5MB

/**
 * Background task state enumeration
 */
export const TaskStatus = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  KILLED: 'killed'
}

/**
 * Task manager class - manages all background tasks
 */
class BackgroundTaskManager extends EventEmitter {
  constructor() {
    super()
    this.tasks = new Map()
    this.taskCounter = 0
  }

  /**
   * Generate a unique task ID
   */
  generateTaskId() {
    return `task_${Date.now()}_${++this.taskCounter}`
  }

  /**
   * Spawn a new background task
   *
   * @param {string} command - The command to execute
   * @param {Object} options - Spawn options
   * @param {string} options.cwd - Working directory
   * @param {Object} options.env - Environment variables
   * @param {boolean} options.shell - Use shell (default: true)
   * @returns {Object} Task object with id, status, and metadata
   */
  spawnBackgroundTask(command, options = {}) {
    const taskId = this.generateTaskId()
    const { cwd = process.cwd(), env = process.env, shell = true } = options

    // Create task object
    const task = {
      id: taskId,
      command,
      status: TaskStatus.RUNNING,
      pid: null,
      startedAt: new Date(),
      completedAt: null,
      exitCode: null,
      output: [], // Array of output lines
      error: null,
      stdout: '',
      stderr: ''
    }

    try {
      // Spawn the child process
      const childProcess = spawn(command, [], {
        cwd,
        env,
        shell,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      })

      task.pid = childProcess.pid
      this.tasks.set(taskId, { task, process: childProcess })

      // Handle stdout
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          const lines = data.toString().split('\n')
          for (const line of lines) {
            if (line) {
              this.addOutputLine(taskId, line, 'stdout')
            }
          }
        })
      }

      // Handle stderr
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          const lines = data.toString().split('\n')
          for (const line of lines) {
            if (line) {
              this.addOutputLine(taskId, line, 'stderr')
            }
          }
        })
      }

      // Handle process exit
      childProcess.on('exit', (code, signal) => {
        task.status = signal ? TaskStatus.KILLED : (code === 0 ? TaskStatus.COMPLETED : TaskStatus.FAILED)
        task.exitCode = code
        task.completedAt = new Date()
        this.emit('task-complete', taskId, task)
      })

      // Handle process error
      childProcess.on('error', (err) => {
        task.status = TaskStatus.FAILED
        task.error = err.message
        task.completedAt = new Date()
        this.emit('task-error', taskId, task, err)
      })

      this.emit('task-spawn', taskId, task)
      return task
    } catch (err) {
      // If spawn fails, mark task as failed
      task.status = TaskStatus.FAILED
      task.error = err.message
      task.completedAt = new Date()
      this.emit('task-error', taskId, task, err)
      return task
    }
  }

  /**
   * Add a line of output to a task
   * Manages buffer size limits
   */
  addOutputLine(taskId, line, stream = 'stdout') {
    const entry = this.tasks.get(taskId)
    if (!entry) return

    const task = entry.task

    // Add to output array
    task.output.push(`[${stream.toUpperCase()}] ${line}`)

    // Also add to stream-specific buffers
    if (stream === 'stdout') {
      task.stdout += line + '\n'
    } else {
      task.stderr += line + '\n'
    }

    // Trim if output exceeds limits
    while (
      task.output.length > MAX_OUTPUT_LINES ||
      task.output.join('\n').length > MAX_OUTPUT_SIZE
    ) {
      task.output.shift()
    }

    // Emit output event
    this.emit('task-output', taskId, line, stream)
  }

  /**
   * Get task information
   */
  getTaskStatus(taskId) {
    const entry = this.tasks.get(taskId)
    if (!entry) return null
    return entry.task
  }

  /**
   * Get buffered output for a task
   *
   * @param {string} taskId - Task ID
   * @param {Object} options - Options
   * @param {number} options.lines - Number of lines to return (default: all)
   * @param {number} options.offset - Starting line offset (default: 0)
   * @returns {string[]} Array of output lines
   */
  getTaskOutput(taskId, options = {}) {
    const entry = this.tasks.get(taskId)
    if (!entry) return []

    const { lines = -1, offset = 0 } = options
    const output = entry.task.output

    if (lines < 0) {
      // Return all lines from offset
      return output.slice(offset)
    } else {
      // Return specific number of lines
      return output.slice(offset, offset + lines)
    }
  }

  /**
   * Get combined output as string
   */
  getTaskOutputAsString(taskId, options = {}) {
    const lines = this.getTaskOutput(taskId, options)
    return lines.join('\n')
  }

  /**
   * Kill a running task
   */
  killTask(taskId) {
    const entry = this.tasks.get(taskId)
    if (!entry) return false

    const { process: childProcess, task } = entry

    try {
      // Try to kill the process group first (Unix)
      // Use negative PID to kill entire process group
      const pid = childProcess.pid
      try {
        process.kill(-pid, 'SIGTERM')
      } catch (groupErr) {
        // If process group kill fails, kill the process directly
        process.kill(pid, 'SIGTERM')
      }

      // Set task status to killed
      task.status = TaskStatus.KILLED
      task.completedAt = new Date()

      this.emit('task-killed', taskId, task)
      return true
    } catch (err) {
      task.error = `Failed to kill task: ${err.message}`
      this.emit('task-error', taskId, task, err)
      return false
    }
  }

  /**
   * List all tasks (running and completed)
   *
   * @param {Object} options - Options
   * @param {string} options.status - Filter by status
   * @param {boolean} options.includeCompleted - Include completed tasks (default: true)
   * @returns {Array} Array of task objects
   */
  listBackgroundTasks(options = {}) {
    const { status = null, includeCompleted = true } = options
    const taskList = []

    for (const entry of this.tasks.values()) {
      const task = entry.task
      if (!includeCompleted && task.status !== TaskStatus.RUNNING) continue
      if (status && task.status !== status) continue
      taskList.push(task)
    }

    return taskList
  }

  /**
   * Get count of running tasks
   */
  getRunningTaskCount() {
    let count = 0
    for (const entry of this.tasks.values()) {
      if (entry.task.status === TaskStatus.RUNNING) count++
    }
    return count
  }

  /**
   * Clean up completed tasks older than specified time
   *
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   * @returns {number} Number of tasks cleaned up
   */
  cleanupTasks(maxAgeMs = 3600000) {
    const now = Date.now()
    let removed = 0

    for (const [taskId, entry] of this.tasks.entries()) {
      const task = entry.task

      // Only clean up completed tasks
      if (task.status === TaskStatus.RUNNING) continue

      // Check age
      const completedTime = task.completedAt?.getTime() || 0
      const age = now - completedTime

      if (age > maxAgeMs) {
        this.tasks.delete(taskId)
        this.emit('task-cleanup', taskId, task)
        removed++
      }
    }

    return removed
  }

  /**
   * Wait for a task to complete
   *
   * @param {string} taskId - Task ID
   * @param {number} timeoutMs - Timeout in milliseconds (default: no timeout)
   * @returns {Promise<Object>} Task object when complete
   */
  waitForTask(taskId, timeoutMs = null) {
    return new Promise((resolve, reject) => {
      const entry = this.tasks.get(taskId)
      if (!entry) {
        return reject(new Error(`Task ${taskId} not found`))
      }

      const task = entry.task

      // If already completed, resolve immediately
      if (task.status !== TaskStatus.RUNNING) {
        return resolve(task)
      }

      // Set up completion listener
      const onComplete = (completedId) => {
        if (completedId === taskId) {
          this.removeListener('task-complete', onComplete)
          clearTimeout(timeoutHandle)
          resolve(this.getTaskStatus(taskId))
        }
      }

      this.on('task-complete', onComplete)

      // Set up timeout if specified
      let timeoutHandle = null
      if (timeoutMs) {
        timeoutHandle = setTimeout(() => {
          this.removeListener('task-complete', onComplete)
          reject(new Error(`Task ${taskId} did not complete within ${timeoutMs}ms`))
        }, timeoutMs)
      }
    })
  }

  /**
   * Get statistics about all tasks
   */
  getStatistics() {
    const stats = {
      total: this.tasks.size,
      running: 0,
      completed: 0,
      failed: 0,
      killed: 0,
      totalOutputLines: 0
    }

    for (const entry of this.tasks.values()) {
      const task = entry.task
      stats[task.status === TaskStatus.RUNNING ? 'running' : task.status]++
      stats.totalOutputLines += task.output.length
    }

    return stats
  }

  /**
   * Clear all tasks and stop processes
   */
  async clearAll() {
    const taskIds = Array.from(this.tasks.keys())

    for (const taskId of taskIds) {
      const entry = this.tasks.get(taskId)
      if (entry && entry.task.status === TaskStatus.RUNNING) {
        try {
          process.kill(-entry.process.pid, 'SIGTERM')
        } catch (err) {
          // Ignore errors during cleanup
        }
      }
    }

    this.tasks.clear()
  }
}

// Export singleton instance
export const taskManager = new BackgroundTaskManager()

/**
 * Convenience functions for module-level API
 */

export function spawnBackgroundTask(command, options = {}) {
  return taskManager.spawnBackgroundTask(command, options)
}

export function listBackgroundTasks(options = {}) {
  return taskManager.listBackgroundTasks(options)
}

export function getTaskOutput(taskId, options = {}) {
  return taskManager.getTaskOutput(taskId, options)
}

export function getTaskOutputAsString(taskId, options = {}) {
  return taskManager.getTaskOutputAsString(taskId, options)
}

export function getTaskStatus(taskId) {
  return taskManager.getTaskStatus(taskId)
}

export function killTask(taskId) {
  return taskManager.killTask(taskId)
}

export function cleanupTasks(maxAgeMs = 3600000) {
  return taskManager.cleanupTasks(maxAgeMs)
}

export function waitForTask(taskId, timeoutMs = null) {
  return taskManager.waitForTask(taskId, timeoutMs)
}

export function getRunningTaskCount() {
  return taskManager.getRunningTaskCount()
}

export function getStatistics() {
  return taskManager.getStatistics()
}

export async function clearAll() {
  return taskManager.clearAll()
}

export default taskManager
