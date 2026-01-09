/**
 * Utils module entry point
 * File operations, search, string utilities, and error handling
 */

// File utilities
export { readFile, writeFile, fileExists, listFiles } from './file.mjs'

// Search utilities
export { search } from './search.mjs'

// String and markdown parsing utilities
export {
  createRegexBuilder,
  encodeUri,
  splitTableCells,
  trimTrailingChar,
  createLinkToken,
  extractCodeBlockContent,
  indentText,
  COMMON_PATTERNS
} from './strings.mjs'

// Error handling utilities
export {
  AppError,
  FileError,
  ApiError,
  ConfigError,
  ToolError,
  PluginError,
  ValidationError,
  formatError,
  formatErrorForClaude,
  getErrorMessage,
  isErrorType,
  withErrorHandler,
  tryCatch,
  rethrowWithContext,
  normalizeError,
  isRetryableError,
  aggregateErrors
} from './errors.mjs'

export default {
  ...(await import('./file.mjs')),
  search: (await import('./search.mjs')).search,
  ...(await import('./strings.mjs')),
  ...(await import('./errors.mjs'))
}
