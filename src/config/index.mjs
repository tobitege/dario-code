/**
 * Config module entry point
 * Application constants and path utilities
 */

// Constants
export {
  ANTHROPIC_API_URL,
  DEFAULT_MODEL,
  APP_NAME,
  VERSION,
  FEATURES
} from './constants.mjs'

// Path utilities
export {
  getConfigDir,
  getConfigPath,
  getLogPath
} from './paths.mjs'

// Environment utilities
export * from './env.mjs'

export default {
  ...await import('./constants.mjs'),
  ...await import('./paths.mjs'),
  ...await import('./env.mjs')
}
