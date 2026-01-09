/**
 * Git module entry point
 * Handles git operations and repository analysis
 */

export { isGitRepo, getStatus, getRepoInfo } from './git.mjs'

export default {
  isGitRepo: (await import('./git.mjs')).isGitRepo,
  getStatus: (await import('./git.mjs')).getStatus,
  getRepoInfo: (await import('./git.mjs')).getRepoInfo
}
