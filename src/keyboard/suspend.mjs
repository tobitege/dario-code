/**
 * Suspend/Resume module
 * Handles suspending operations to background and resuming them
 */

class SuspendManager {
  constructor() {
    this.suspendedOperations = []
    this.suspendCallbacks = {
      onSuspend: null,
      onResume: null,
      onList: null
    }
    this.operationCounter = 0
  }

  /**
   * Register suspend callbacks
   */
  onSuspend(callback) {
    this.suspendCallbacks.onSuspend = callback
  }

  onResume(callback) {
    this.suspendCallbacks.onResume = callback
  }

  onList(callback) {
    this.suspendCallbacks.onList = callback
  }

  /**
   * Suspend a running operation
   */
  suspend(operation) {
    const id = this.operationCounter++
    const suspended = {
      id,
      operation,
      timestamp: Date.now(),
      paused: true,
      signal: new AbortController()
    }

    this.suspendedOperations.push(suspended)

    if (this.suspendCallbacks.onSuspend) {
      this.suspendCallbacks.onSuspend({
        id,
        operation,
        timestamp: suspended.timestamp
      })
    }

    return id
  }

  /**
   * Resume a suspended operation
   */
  resume(id) {
    const index = this.suspendedOperations.findIndex((op) => op.id === id)

    if (index === -1) {
      return null
    }

    const suspended = this.suspendedOperations[index]
    suspended.paused = false

    if (this.suspendCallbacks.onResume) {
      this.suspendCallbacks.onResume({
        id: suspended.id,
        operation: suspended.operation,
        resumeTime: Date.now()
      })
    }

    // Remove from list after resuming
    this.suspendedOperations.splice(index, 1)

    return suspended
  }

  /**
   * Resume the most recent operation
   */
  resumeLatest() {
    if (this.suspendedOperations.length === 0) {
      return null
    }

    const latest = this.suspendedOperations[this.suspendedOperations.length - 1]
    return this.resume(latest.id)
  }

  /**
   * Resume all suspended operations
   */
  resumeAll() {
    const resumed = []

    while (this.suspendedOperations.length > 0) {
      const latest = this.suspendedOperations[this.suspendedOperations.length - 1]
      const result = this.resume(latest.id)
      if (result) {
        resumed.push(result)
      }
    }

    return resumed
  }

  /**
   * List all suspended operations
   */
  list() {
    const operations = this.suspendedOperations.map((op) => ({
      id: op.id,
      operation: op.operation,
      timestamp: op.timestamp,
      duration: Date.now() - op.timestamp,
      paused: op.paused
    }))

    if (this.suspendCallbacks.onList) {
      this.suspendCallbacks.onList(operations)
    }

    return operations
  }

  /**
   * Kill a suspended operation
   */
  kill(id) {
    const index = this.suspendedOperations.findIndex((op) => op.id === id)

    if (index === -1) {
      return false
    }

    const suspended = this.suspendedOperations[index]
    suspended.signal.abort()
    this.suspendedOperations.splice(index, 1)

    return true
  }

  /**
   * Kill all suspended operations
   */
  killAll() {
    for (const suspended of this.suspendedOperations) {
      suspended.signal.abort()
    }

    this.suspendedOperations = []
  }

  /**
   * Get count of suspended operations
   */
  getCount() {
    return this.suspendedOperations.length
  }

  /**
   * Check if any operations are suspended
   */
  hasSuspended() {
    return this.suspendedOperations.length > 0
  }

  /**
   * Get operation by ID
   */
  getOperation(id) {
    return this.suspendedOperations.find((op) => op.id === id)
  }
}

// Export singleton instance
export const suspendManager = new SuspendManager()

/**
 * Handle SIGTSTP signal (Ctrl+Z)
 */
export function setupSuspendSignalHandlers(manager = suspendManager) {
  // Handle SIGTSTP (Ctrl+Z)
  process.on('SIGTSTP', () => {
    // Send process to background
    process.kill(process.pid, 'SIGSTOP')
  })

  // Handle SIGCONT (fg command or similar)
  process.on('SIGCONT', () => {
    // Resume from background
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
  })
}

/**
 * Format suspended operation for display
 */
export function formatSuspendedOperation(operation) {
  const durationMs = Date.now() - operation.timestamp
  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)

  let duration = ''
  if (minutes > 0) {
    duration = `${minutes}m${seconds % 60}s`
  } else {
    duration = `${seconds}s`
  }

  return `[${operation.id}] ${operation.operation} (suspended ${duration} ago)`
}
