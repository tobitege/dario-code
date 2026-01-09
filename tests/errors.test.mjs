/**
 * Error Handling Utilities Tests
 */

import { describe, it, expect } from 'vitest'
import {
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
} from '../src/utils/errors.mjs'

describe('Custom Error Classes', () => {
  it('creates AppError with message and code', () => {
    const error = new AppError('Something went wrong', 'TEST_CODE')
    expect(error.message).toBe('Something went wrong')
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('AppError')
  })

  it('creates FileError with file path and operation', () => {
    const error = new FileError('File not found', '/path/to/file.txt', 'read')
    expect(error.message).toBe('File not found')
    expect(error.filePath).toBe('/path/to/file.txt')
    expect(error.operation).toBe('read')
    expect(error.name).toBe('FileError')
  })

  it('creates ApiError with status code and response', () => {
    const response = { error: 'Bad request' }
    const error = new ApiError('API request failed', 400, response)
    expect(error.message).toBe('API request failed')
    expect(error.statusCode).toBe(400)
    expect(error.response).toEqual(response)
    expect(error.name).toBe('ApiError')
  })

  it('creates ConfigError with config key', () => {
    const error = new ConfigError('Invalid config', 'apiKey')
    expect(error.message).toBe('Invalid config')
    expect(error.configKey).toBe('apiKey')
    expect(error.name).toBe('ConfigError')
  })

  it('creates ToolError with tool name', () => {
    const error = new ToolError('Tool execution failed', 'bash')
    expect(error.message).toBe('Tool execution failed')
    expect(error.toolName).toBe('bash')
    expect(error.name).toBe('ToolError')
  })

  it('creates PluginError with plugin name', () => {
    const error = new PluginError('Plugin load failed', 'test-plugin')
    expect(error.message).toBe('Plugin load failed')
    expect(error.pluginName).toBe('test-plugin')
    expect(error.name).toBe('PluginError')
  })

  it('creates ValidationError with field and value', () => {
    const error = new ValidationError('Invalid email', 'email', 'not-an-email')
    expect(error.message).toBe('Invalid email')
    expect(error.field).toBe('email')
    expect(error.value).toBe('not-an-email')
    expect(error.name).toBe('ValidationError')
  })
})

describe('Error Formatting', () => {
  it('formats basic error message', () => {
    const error = new Error('Something failed')
    const formatted = formatError(error)
    expect(formatted).toBe('Something failed')
  })

  it('formats error with code', () => {
    const error = new AppError('Failed', 'ERR_CODE')
    const formatted = formatError(error)
    expect(formatted).toContain('[ERR_CODE]')
    expect(formatted).toContain('Failed')
  })

  it('formats FileError with details', () => {
    const error = new FileError('Not found', '/path/file.txt', 'read')
    const formatted = formatError(error)
    expect(formatted).toContain('Not found')
    expect(formatted).toContain('File: /path/file.txt')
    expect(formatted).toContain('Operation: read')
  })

  it('formats ApiError with status code', () => {
    const error = new ApiError('Request failed', 404)
    const formatted = formatError(error)
    expect(formatted).toContain('Request failed')
    expect(formatted).toContain('Status: 404')
  })

  it('formats ValidationError with field and value', () => {
    const error = new ValidationError('Invalid', 'email', 'bad@')
    const formatted = formatError(error)
    expect(formatted).toContain('Invalid')
    expect(formatted).toContain('Field: email')
    expect(formatted).toContain('Value: bad@')
  })

  it('formats error for Claude with context', () => {
    const error = new Error('File not found')
    const formatted = formatErrorForClaude(error, 'Reading config')
    expect(formatted).toBe('Reading config: File not found')
  })

  it('formats error for Claude without context', () => {
    const error = new Error('File not found')
    const formatted = formatErrorForClaude(error)
    expect(formatted).toBe('File not found')
  })

  it('handles string errors', () => {
    const formatted = formatError('String error')
    expect(formatted).toBe('String error')
  })

  it('handles null/undefined errors', () => {
    const formatted = formatError(null)
    expect(formatted).toBe('Unknown error')
  })

  it('extracts error message from Error object', () => {
    const error = new Error('Test message')
    expect(getErrorMessage(error)).toBe('Test message')
  })

  it('extracts error message from string', () => {
    expect(getErrorMessage('String error')).toBe('String error')
  })

  it('handles null error in getErrorMessage', () => {
    expect(getErrorMessage(null)).toBe('Unknown error')
  })
})

describe('Error Type Checking', () => {
  it('checks if error is specific type', () => {
    const error = new FileError('Not found', '/file.txt')
    expect(isErrorType(error, FileError)).toBe(true)
    expect(isErrorType(error, ApiError)).toBe(false)
  })

  it('checks AppError base class', () => {
    const error = new FileError('Not found', '/file.txt')
    expect(isErrorType(error, AppError)).toBe(true)
  })
})

describe('Error Handling Helpers', () => {
  it('wraps function with error handler', async () => {
    const fn = async () => {
      throw new Error('Test error')
    }
    const errorHandler = (error) => `Handled: ${error.message}`

    const wrapped = withErrorHandler(fn, errorHandler)
    const result = await wrapped()

    expect(result).toBe('Handled: Test error')
  })

  it('wraps successful function', async () => {
    const fn = async () => 'success'
    const errorHandler = () => 'error'

    const wrapped = withErrorHandler(fn, errorHandler)
    const result = await wrapped()

    expect(result).toBe('success')
  })

  it('tryCatch returns [null, result] on success', async () => {
    const fn = async () => 'success'
    const [error, result] = await tryCatch(fn)

    expect(error).toBe(null)
    expect(result).toBe('success')
  })

  it('tryCatch returns [error, null] on failure', async () => {
    const fn = async () => {
      throw new Error('Failed')
    }
    const [error, result] = await tryCatch(fn)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Failed')
    expect(result).toBe(null)
  })

  it('rethrows error with context', () => {
    const original = new Error('Original error')

    expect(() => {
      rethrowWithContext(original, 'Additional context')
    }).toThrow('Additional context: Original error')
  })

  it('rethrows custom error preserving type', () => {
    const original = new FileError('Not found', '/file.txt')

    try {
      rethrowWithContext(original, 'Reading config')
    } catch (error) {
      expect(error).toBeInstanceOf(FileError)
      expect(error.message).toContain('Reading config')
      expect(error.message).toContain('Not found')
    }
  })

  it('normalizes Error object', () => {
    const error = new Error('Test error')
    const normalized = normalizeError(error)
    expect(normalized).toBe(error)
  })

  it('normalizes string to Error', () => {
    const normalized = normalizeError('String error')
    expect(normalized).toBeInstanceOf(Error)
    expect(normalized.message).toBe('String error')
  })

  it('normalizes object with message', () => {
    const normalized = normalizeError({ message: 'Object error' })
    expect(normalized).toBeInstanceOf(Error)
    expect(normalized.message).toBe('Object error')
  })

  it('normalizes invalid input with default message', () => {
    const normalized = normalizeError(123, 'Custom default')
    expect(normalized).toBeInstanceOf(Error)
    expect(normalized.message).toBe('Custom default')
  })
})

describe('Retryable Error Detection', () => {
  it('detects timeout errors as retryable', () => {
    const error = new Error('Request timeout')
    expect(isRetryableError(error)).toBe(true)
  })

  it('detects network errors as retryable', () => {
    const error = new Error('Network error occurred')
    expect(isRetryableError(error)).toBe(true)
  })

  it('detects connection errors as retryable', () => {
    const error = new Error('ECONNRESET')
    expect(isRetryableError(error)).toBe(true)
  })

  it('detects rate limit errors as retryable', () => {
    const error = new ApiError('Rate limited', 429)
    expect(isRetryableError(error)).toBe(true)
  })

  it('detects service unavailable as retryable', () => {
    const error = new ApiError('Service unavailable', 503)
    expect(isRetryableError(error)).toBe(true)
  })

  it('non-retryable errors return false', () => {
    const error = new Error('Invalid input')
    expect(isRetryableError(error)).toBe(false)
  })

  it('handles null error', () => {
    expect(isRetryableError(null)).toBe(false)
  })
})

describe('Error Aggregation', () => {
  it('aggregates multiple errors', () => {
    const errors = [
      new Error('Error 1'),
      new Error('Error 2'),
      new Error('Error 3')
    ]
    const message = aggregateErrors(errors)

    expect(message).toContain('Multiple errors occurred')
    expect(message).toContain('1. Error 1')
    expect(message).toContain('2. Error 2')
    expect(message).toContain('3. Error 3')
  })

  it('handles single error', () => {
    const errors = [new Error('Single error')]
    const message = aggregateErrors(errors)

    expect(message).toBe('Single error')
  })

  it('handles empty array', () => {
    const message = aggregateErrors([])
    expect(message).toBe('No errors')
  })

  it('uses custom prefix', () => {
    const errors = [new Error('Error 1'), new Error('Error 2')]
    const message = aggregateErrors(errors, 'Validation failed')

    expect(message).toContain('Validation failed')
  })
})
