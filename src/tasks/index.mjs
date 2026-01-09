/**
 * Background Tasks Module
 *
 * Exports the background task management system for controlling
 * long-running processes.
 */

import { taskManager } from './background.mjs'

export {
  taskManager,
  TaskStatus,
  spawnBackgroundTask,
  listBackgroundTasks,
  getTaskOutput,
  getTaskOutputAsString,
  getTaskStatus,
  killTask,
  cleanupTasks,
  waitForTask,
  getRunningTaskCount,
  getStatistics,
  clearAll
} from './background.mjs'

// Convenience alias for tests
export { spawnBackgroundTask as spawn } from './background.mjs'

// Export UI components
export {
  TaskStatusDisplay,
  formatTaskForDisplay,
  getTasksForDisplay,
  TaskSelectorState,
  getTaskSelectorState,
  handleTaskSelectorKey,
  renderTaskListText,
  MAX_VISIBLE_TASKS
} from './tasksUI.mjs'

export default taskManager
