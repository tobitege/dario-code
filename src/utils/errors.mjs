/**
 * Error Handling Utilities
 *
 * Centralized error formatting, custom error types, and error handling helpers.
 */

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(message, code = 'APP_ERROR') {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

/**
 * File operation errors
 */
export class FileError extends AppError {
  constructor(message, filePath, operation = 'access') {
    super(message, 'FILE_ERROR')
    this.name = 'FileError'
    this.filePath = filePath
    this.operation = operation
  }
}

/**
 * API/network errors
 */
export class ApiError extends AppError {
  constructor(message, statusCode = null, response = null) {
    super(message, 'API_ERROR')
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.response = response
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends AppError {
  constructor(message, configKey = null) {
    super(message, 'CONFIG_ERROR')
    this.name = 'ConfigError'
    this.configKey = configKey
  }
}

/**
 * Tool execution errors
 */
export class ToolError extends AppError {
  constructor(message, toolName = null) {
    super(message, 'TOOL_ERROR')
    this.name = 'ToolError'
    this.toolName = toolName
  }
}

/**
 * Plugin errors
 */
export class PluginError extends AppError {
  constructor(message, pluginName = null) {
    super(message, 'PLUGIN_ERROR')
    this.name = 'PluginError'
    this.pluginName = pluginName
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format an error for display to user
 *
 * @param {Error} error - The error to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeStack - Include stack trace (default: false)
 * @param {boolean} options.verbose - Include extra details (default: false)
 * @returns {string} Formatted error message
 */
export function formatError(error, options = {}) {
  const { includeStack = false, verbose = false } = options

  if (!error) return 'Unknown error'

  // Handle string errors
  if (typeof error === 'string') return error

  // Start with the message
  let formatted = error.message || 'Unknown error'

  // Add error code if available
  if (error.code) {
    formatted = `[${error.code}] ${formatted}`
  }

  // Add specific details for custom error types
  if (error instanceof FileError && error.filePath) {
    formatted += `\n  File: ${error.filePath}`
    if (error.operation) {
      formatted += `\n  Operation: ${error.operation}`
    }
  } else if (error instanceof ApiError && error.statusCode) {
    formatted += `\n  Status: ${error.statusCode}`
  } else if (error instanceof ConfigError && error.configKey) {
    formatted += `\n  Config key: ${error.configKey}`
  } else if (error instanceof ToolError && error.toolName) {
    formatted += `\n  Tool: ${error.toolName}`
  } else if (error instanceof PluginError && error.pluginName) {
    formatted += `\n  Plugin: ${error.pluginName}`
  } else if (error instanceof ValidationError) {
    if (error.field) formatted += `\n  Field: ${error.field}`
    if (error.value !== null) formatted += `\n  Value: ${error.value}`
  }

  // Add stack trace if requested
  if (includeStack && error.stack) {
    formatted += `\n\nStack trace:\n${error.stack}`
  }

  // Add verbose details if available
  if (verbose && error.response) {
    formatted += `\n\nResponse: ${JSON.stringify(error.response, null, 2)}`
  }

  return formatted
}

/**
 * Format error for Claude (concise, actionable)
 *
 * @param {Error} error - The error to format
 * @param {string} context - Additional context about what was being done
 * @returns {string} Formatted error message
 */
export function formatErrorForClaude(error, context = '') {
  const message = error?.message || String(error)
  const prefix = context ? `${context}: ` : ''
  return `${prefix}${message}`
}

/**
 * Extract just the error message (no stack, no code)
 *
 * @param {Error|string} error - The error
 * @returns {string} The message
 */
export function getErrorMessage(error) {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  return error.message || 'Unknown error'
}

/**
 * Check if error is a specific type
 *
 * @param {Error} error - The error to check
 * @param {Function} errorClass - The error class to check against
 * @returns {boolean} True if error is instance of errorClass
 */
export function isErrorType(error, errorClass) {
  return error instanceof errorClass
}

// ============================================================================
// Error Handling Helpers
// ============================================================================

/**
 * Wrap a function with error handling
 *
 * @param {Function} fn - The function to wrap
 * @param {Function} errorHandler - Error handler callback
 * @returns {Function} Wrapped function
 */
export function withErrorHandler(fn, errorHandler) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      return errorHandler(error, ...args)
    }
  }
}

/**
 * Safely execute a function and return [error, result]
 *
 * @param {Function} fn - Function to execute
 * @param {...any} args - Arguments to pass
 * @returns {Promise<[Error|null, any]>} Tuple of [error, result]
 */
export async function tryCatch(fn, ...args) {
  try {
    const result = await fn(...args)
    return [null, result]
  } catch (error) {
    return [error, null]
  }
}

/**
 * Rethrow error with additional context
 *
 * @param {Error} error - Original error
 * @param {string} context - Additional context message
 * @throws {Error} Enhanced error with context
 */
export function rethrowWithContext(error, context) {
  const message = `${context}: ${getErrorMessage(error)}`

  // Preserve error type if custom
  if (error instanceof AppError) {
    const newError = new error.constructor(message)
    newError.stack = error.stack
    throw newError
  }

  // Generic error
  const newError = new Error(message)
  newError.stack = error.stack
  throw newError
}

/**
 * Create error from various input types
 *
 * @param {any} input - Error input (Error, string, object, etc.)
 * @param {string} defaultMessage - Default message if input is invalid
 * @returns {Error} Error object
 */
export function normalizeError(input, defaultMessage = 'Unknown error') {
  if (input instanceof Error) return input
  if (typeof input === 'string') return new Error(input)
  if (input && typeof input === 'object' && input.message) {
    return new Error(input.message)
  }
  return new Error(defaultMessage)
}

/**
 * Check if error is retryable (network, timeout, etc.)
 *
 * @param {Error} error - The error to check
 * @returns {boolean} True if error might be retryable
 */
export function isRetryableError(error) {
  if (!error) return false

  const message = getErrorMessage(error).toLowerCase()

  // Network errors
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('econnrefused')
  ) {
    return true
  }

  // API rate limits
  if (error instanceof ApiError) {
    return error.statusCode === 429 || error.statusCode === 503
  }

  return false
}

/**
 * Aggregate multiple errors into one message
 *
 * @param {Error[]} errors - Array of errors
 * @param {string} prefix - Prefix message
 * @returns {string} Combined error message
 */
export function aggregateErrors(errors, prefix = 'Multiple errors occurred') {
  if (!errors || errors.length === 0) return 'No errors'
  if (errors.length === 1) return getErrorMessage(errors[0])

  const messages = errors.map((err, i) => `${i + 1}. ${getErrorMessage(err)}`)
  return `${prefix}:\n${messages.join('\n')}`
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Custom error classes
  AppError,
  FileError,
  ApiError,
  ConfigError,
  ToolError,
  PluginError,
  ValidationError,

  // Formatting
  formatError,
  formatErrorForClaude,
  getErrorMessage,
  isErrorType,

  // Helpers
  withErrorHandler,
  tryCatch,
  rethrowWithContext,
  normalizeError,
  isRetryableError,
  aggregateErrors
}
