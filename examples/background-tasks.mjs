/**
 * Background Tasks Examples
 *
 * This file demonstrates various use cases for the background task system.
 * Run with: node examples/background-tasks.mjs
 */

import {
  spawnBackgroundTask,
  listBackgroundTasks,
  getTaskStatus,
  getTaskOutput,
  getTaskOutputAsString,
  waitForTask,
  killTask,
  getStatistics,
  cleanupTasks,
  TaskStatus
} from '../src/tasks/index.mjs'

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(color, ...args) {
  console.log(`${color}${args.join(' ')}${colors.reset}`)
}

async function example1() {
  log(colors.bright + colors.cyan, '=== Example 1: Simple Background Task ===')
  log(colors.green, 'Spawning a simple echo command...')

  const task = spawnBackgroundTask('echo "Hello from background task!"')
  log(colors.yellow, `Spawned task: ${task.id}`)
  log(colors.yellow, `PID: ${task.pid}`)

  // Wait a moment for the task to complete
  await new Promise(resolve => setTimeout(resolve, 500))

  const status = getTaskStatus(task.id)
  log(colors.green, `Task status: ${status.status}`)

  const output = getTaskOutputAsString(task.id)
  log(colors.blue, `Output: ${output.trim()}`)
  console.log()
}

async function example2() {
  log(colors.bright + colors.cyan, '=== Example 2: Multiple Concurrent Tasks ===')
  log(colors.green, 'Spawning three tasks in parallel...')

  const tasks = [
    spawnBackgroundTask('echo "Task 1"'),
    spawnBackgroundTask('echo "Task 2"'),
    spawnBackgroundTask('echo "Task 3"')
  ]

  tasks.forEach((task, i) => {
    log(colors.yellow, `  Task ${i + 1}: ${task.id}`)
  })

  // Wait for all tasks
  await new Promise(resolve => setTimeout(resolve, 500))

  const stats = getStatistics()
  log(colors.green, `Total tasks: ${stats.total}`)
  log(colors.green, `Completed: ${stats.completed}`)
  console.log()
}

async function example3() {
  log(colors.bright + colors.cyan, '=== Example 3: Using waitForTask ===')
  log(colors.green, 'Spawning task and waiting for completion...')

  const task = spawnBackgroundTask('echo "Waiting for this task"')

  try {
    const completed = await waitForTask(task.id, 5000)
    log(colors.green, `Task completed with status: ${completed.status}`)
    log(colors.green, `Exit code: ${completed.exitCode}`)
  } catch (err) {
    log(colors.yellow, `Error: ${err.message}`)
  }
  console.log()
}

async function example4() {
  log(colors.bright + colors.cyan, '=== Example 4: Task Output Retrieval ===')
  log(colors.green, 'Spawning task with multiple output lines...')

  const task = spawnBackgroundTask('for i in 1 2 3 4 5; do echo "Line $i"; done', {
    shell: true
  })

  await new Promise(resolve => setTimeout(resolve, 500))

  const output = getTaskOutput(task.id)
  log(colors.green, `Output lines: ${output.length}`)
  output.forEach((line, i) => {
    log(colors.blue, `  ${i + 1}: ${line}`)
  })
  console.log()
}

async function example5() {
  log(colors.bright + colors.cyan, '=== Example 5: Task Filtering and Listing ===')
  log(colors.green, 'Spawning some tasks and listing them...')

  // Spawn a few tasks
  const task1 = spawnBackgroundTask('echo "Task 1"')
  const task2 = spawnBackgroundTask('echo "Task 2"')
  const task3 = spawnBackgroundTask('false', { shell: true })  // This will fail

  await new Promise(resolve => setTimeout(resolve, 500))

  log(colors.green, 'All tasks:')
  const allTasks = listBackgroundTasks()
  allTasks.forEach(task => {
    log(colors.blue, `  ${task.id}: ${task.status}`)
  })

  log(colors.green, 'Completed tasks:')
  const completed = listBackgroundTasks({ status: TaskStatus.COMPLETED })
  log(colors.blue, `  Count: ${completed.length}`)

  log(colors.green, 'Failed tasks:')
  const failed = listBackgroundTasks({ status: TaskStatus.FAILED })
  log(colors.blue, `  Count: ${failed.length}`)
  console.log()
}

async function example6() {
  log(colors.bright + colors.cyan, '=== Example 6: Error Handling ===')
  log(colors.green, 'Spawning task that will fail...')

  const task = spawnBackgroundTask('exit 1', { shell: true })

  await new Promise(resolve => setTimeout(resolve, 500))

  const status = getTaskStatus(task.id)
  if (status.status === TaskStatus.FAILED) {
    log(colors.yellow, `Task failed with exit code: ${status.exitCode}`)
  } else {
    log(colors.green, `Task status: ${status.status}`)
  }
  console.log()
}

async function example7() {
  log(colors.bright + colors.cyan, '=== Example 7: Statistics Monitoring ===')
  log(colors.green, 'Getting task statistics...')

  // Spawn a few tasks
  spawnBackgroundTask('echo "Task 1"')
  spawnBackgroundTask('echo "Task 2"')

  await new Promise(resolve => setTimeout(resolve, 500))

  const stats = getStatistics()
  log(colors.blue, `Total tasks: ${stats.total}`)
  log(colors.blue, `Running: ${stats.running}`)
  log(colors.blue, `Completed: ${stats.completed}`)
  log(colors.blue, `Failed: ${stats.failed}`)
  log(colors.blue, `Killed: ${stats.killed}`)
  log(colors.blue, `Total output lines: ${stats.totalOutputLines}`)
  console.log()
}

async function example8() {
  log(colors.bright + colors.cyan, '=== Example 8: Cleanup Old Tasks ===')
  log(colors.green, 'Spawning tasks and cleaning up...')

  // Spawn and complete a task
  const task = spawnBackgroundTask('echo "To be cleaned"')
  await new Promise(resolve => setTimeout(resolve, 500))

  let stats = getStatistics()
  log(colors.green, `Before cleanup: ${stats.total} tasks`)

  // Cleanup all completed tasks
  const removed = cleanupTasks(0)
  log(colors.green, `Removed ${removed} tasks`)

  stats = getStatistics()
  log(colors.green, `After cleanup: ${stats.total} tasks`)
  console.log()
}

// Run all examples
async function runAll() {
  log(colors.bright + colors.bright, 'BACKGROUND TASKS EXAMPLES')
  log(colors.bright + colors.bright, '========================\n')

  await example1()
  await example2()
  await example3()
  await example4()
  await example5()
  await example6()
  await example7()
  await example8()

  log(colors.bright + colors.green, 'All examples completed!')
}

// Run examples
runAll().catch(err => {
  console.error('Error running examples:', err)
  process.exit(1)
})
