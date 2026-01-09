/**
 * API Retry Logic with Exponential Backoff
 *
 * Extracted from cli.mjs lines 81440-81600
 * Provides retry strategies with exponential backoff, capacity management, and error classification
 */

// Retry constants
export const DEFAULT_RETRY_DELAY_BASE = 100 // milliseconds
export const MAXIMUM_RETRY_DELAY = 20000 // 20 seconds
export const THROTTLING_RETRY_DELAY_BASE = 500 // milliseconds
export const INITIAL_RETRY_TOKENS = 500
export const RETRY_COST = 5
export const TIMEOUT_RETRY_COST = 10
export const NO_RETRY_INCREMENT = 1
export const DEFAULT_MAX_ATTEMPTS = 3

// Retry modes
export const RETRY_MODES = {
  STANDARD: 'standard',
  ADAPTIVE: 'adaptive'
}

/**
 * Creates a default retry backoff strategy using exponential backoff with jitter
 *
 * @returns {Object} Strategy with computeNextBackoffDelay and setDelayBase methods
 *
 */
export function getDefaultRetryBackoffStrategy() {
  let delayBase = DEFAULT_RETRY_DELAY_BASE

  return {
    /**
     * Computes the next backoff delay using exponential backoff with random jitter
     * Formula: min(MAX_DELAY, random * 2^retryCount * delayBase)
     *
     * @param {number} retryCount - The current retry attempt number
     * @returns {number} Delay in milliseconds
     */
    computeNextBackoffDelay: (retryCount) => {
      return Math.floor(
        Math.min(
          MAXIMUM_RETRY_DELAY,
          Math.random() * (2 ** retryCount) * delayBase
        )
      )
    },

    /**
     * Updates the base delay for backoff calculations
     *
     * @param {number} newDelayBase - New base delay in milliseconds
     */
    setDelayBase: (newDelayBase) => {
      delayBase = newDelayBase
    }
  }
}

/**
 * Creates a retry token representing a single retry attempt
 *
 * @param {Object} options - Token options
 * @param {number} options.retryDelay - Delay before retry in milliseconds
 * @param {number} options.retryCount - Current retry attempt number
 * @param {number} [options.retryCost] - Cost of this retry in capacity tokens
 * @returns {Object} Retry token with getter methods
 *
 */
export function createDefaultRetryToken({ retryDelay, retryCount, retryCost }) {
  return {
    getRetryCount: () => retryCount,
    getRetryDelay: () => Math.min(MAXIMUM_RETRY_DELAY, retryDelay),
    getRetryCost: () => retryCost
  }
}

/**
 * Standard retry strategy with capacity-based retry management
 *
 * Implements exponential backoff with capacity tokens to prevent retry storms
 *
 */
export class StandardRetryStrategy {
  /**
   * @param {number|Function} maxAttempts - Max retry attempts or provider function
   */
  constructor(maxAttempts) {
    this.maxAttempts = maxAttempts
    this.mode = RETRY_MODES.STANDARD
    this.capacity = INITIAL_RETRY_TOKENS
    this.retryBackoffStrategy = getDefaultRetryBackoffStrategy()
    this.maxAttemptsProvider = typeof maxAttempts === 'function'
      ? maxAttempts
      : async () => maxAttempts
  }

  /**
   * Acquires the initial retry token before first attempt
   *
   * @param {string} partitionId - Partition identifier for request
   * @returns {Promise<Object>} Initial retry token
   */
  async acquireInitialRetryToken(partitionId) {
    return createDefaultRetryToken({
      retryDelay: DEFAULT_RETRY_DELAY_BASE,
      retryCount: 0
    })
  }

  /**
   * Refreshes retry token for a new retry attempt
   *
   * @param {Object} token - Current retry token
   * @param {Object} errorInfo - Error information
   * @param {string} errorInfo.errorType - Type: THROTTLING, TRANSIENT, etc.
   * @param {Date} [errorInfo.retryAfterHint] - Server-provided retry-after hint
   * @returns {Promise<Object>} New retry token
   * @throws {Error} If retry should not be attempted
   *
   */
  async refreshRetryTokenForRetry(token, errorInfo) {
    const maxAttempts = await this.getMaxAttempts()

    if (this.shouldRetry(token, errorInfo, maxAttempts)) {
      const errorType = errorInfo.errorType

      // Use throttling-specific delay for throttle errors
      this.retryBackoffStrategy.setDelayBase(
        errorType === 'THROTTLING'
          ? THROTTLING_RETRY_DELAY_BASE
          : DEFAULT_RETRY_DELAY_BASE
      )

      const computedDelay = this.retryBackoffStrategy.computeNextBackoffDelay(
        token.getRetryCount()
      )

      // Use server hint if provided, otherwise use computed delay
      const retryDelay = errorInfo.retryAfterHint
        ? Math.max(errorInfo.retryAfterHint.getTime() - Date.now() || 0, computedDelay)
        : computedDelay

      const retryCost = this.getCapacityCost(errorType)
      this.capacity -= retryCost

      return createDefaultRetryToken({
        retryDelay,
        retryCount: token.getRetryCount() + 1,
        retryCost
      })
    }

    throw new Error('No retry token available')
  }

  /**
   * Records successful request and refunds capacity
   *
   * @param {Object} token - Retry token from successful request
   */
  recordSuccess(token) {
    const retryCost = token.getRetryCost()
    const refund = retryCost !== null && retryCost !== undefined
      ? retryCost
      : NO_RETRY_INCREMENT

    this.capacity = Math.max(INITIAL_RETRY_TOKENS, this.capacity + refund)
  }

  /**
   * Gets current retry capacity
   *
   * @returns {number} Available capacity tokens
   */
  getCapacity() {
    return this.capacity
  }

  /**
   * Gets maximum retry attempts
   *
   * @returns {Promise<number>} Max attempts
   */
  async getMaxAttempts() {
    try {
      return await this.maxAttemptsProvider()
    } catch (error) {
      console.warn(
        `Max attempts provider could not resolve. Using default of ${DEFAULT_MAX_ATTEMPTS}`
      )
      return DEFAULT_MAX_ATTEMPTS
    }
  }

  /**
   * Determines if retry should be attempted
   *
   * @param {Object} token - Current retry token
   * @param {Object} errorInfo - Error information
   * @param {number} maxAttempts - Maximum allowed attempts
   * @returns {boolean} True if should retry
   *
   */
  shouldRetry(token, errorInfo, maxAttempts) {
    return (
      token.getRetryCount() < maxAttempts &&
      this.capacity >= this.getCapacityCost(errorInfo.errorType) &&
      this.isRetryableError(errorInfo.errorType)
    )
  }

  /**
   * Gets capacity cost for error type
   *
   * @param {string} errorType - Error type
   * @returns {number} Capacity cost
   */
  getCapacityCost(errorType) {
    return errorType === 'TRANSIENT' ? TIMEOUT_RETRY_COST : RETRY_COST
  }

  /**
   * Checks if error type is retryable
   *
   * @param {string} errorType - Error type
   * @returns {boolean} True if retryable
   */
  isRetryableError(errorType) {
    return errorType === 'THROTTLING' || errorType === 'TRANSIENT'
  }
}

/**
 * Adaptive retry strategy with rate limiting
 *
 * Extends standard strategy with client-side rate limiting to prevent
 * overwhelming servers during high error rates
 *
 */
export class AdaptiveRetryStrategy {
  /**
   * @param {number|Function} maxAttemptsProvider - Max attempts provider
   * @param {Object} [options] - Strategy options
   * @param {Object} [options.rateLimiter] - Custom rate limiter
   */
  constructor(maxAttemptsProvider, options = {}) {
    this.maxAttemptsProvider = maxAttemptsProvider
    this.mode = RETRY_MODES.ADAPTIVE

    const { rateLimiter } = options
    this.rateLimiter = rateLimiter || new DefaultRateLimiter()
    this.standardRetryStrategy = new StandardRetryStrategy(maxAttemptsProvider)
  }

  /**
   * Acquires initial retry token with rate limiting
   */
  async acquireInitialRetryToken(partitionId) {
    await this.rateLimiter.getSendToken()
    return this.standardRetryStrategy.acquireInitialRetryToken(partitionId)
  }

  /**
   * Refreshes retry token with rate limiter update
   */
  async refreshRetryTokenForRetry(token, errorInfo) {
    this.rateLimiter.updateClientSendingRate(errorInfo)
    return this.standardRetryStrategy.refreshRetryTokenForRetry(token, errorInfo)
  }

  /**
   * Records success and updates rate limiter
   */
  recordSuccess(token) {
    this.rateLimiter.updateClientSendingRate({})
    this.standardRetryStrategy.recordSuccess(token)
  }
}

/**
 * Simple default rate limiter implementation
 *
 * Provides basic rate limiting for adaptive retry strategy
 */
export class DefaultRateLimiter {
  constructor() {
    this.tokens = 100
    this.lastRefill = Date.now()
  }

  async getSendToken() {
    // Simple token bucket implementation
    const now = Date.now()
    const elapsed = now - this.lastRefill

    // Refill tokens at 10 per second
    this.tokens = Math.min(100, this.tokens + (elapsed / 100))
    this.lastRefill = now

    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }

    // Wait for token availability
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  updateClientSendingRate(errorInfo) {
    // Adjust token bucket based on error type
    if (errorInfo.errorType === 'THROTTLING') {
      this.tokens = Math.max(0, this.tokens - 10)
    }
  }
}

/**
 * Configured retry strategy with custom backoff
 *
 * Allows custom delay computation functions
 *
 */
export class ConfiguredRetryStrategy extends StandardRetryStrategy {
  /**
   * @param {number|Function} maxAttempts - Max attempts
   * @param {number|Function} [delayDecider] - Custom delay or delay function
   */
  constructor(maxAttempts, delayDecider = DEFAULT_RETRY_DELAY_BASE) {
    super(typeof maxAttempts === 'function' ? maxAttempts : async () => maxAttempts)

    if (typeof delayDecider === 'number') {
      this.computeNextBackoffDelay = () => delayDecider
    } else {
      this.computeNextBackoffDelay = delayDecider
    }
  }

  async refreshRetryTokenForRetry(token, errorInfo) {
    const newToken = await super.refreshRetryTokenForRetry(token, errorInfo)

    // Override delay with custom computation
    newToken.getRetryDelay = () => this.computeNextBackoffDelay(newToken.getRetryCount())

    return newToken
  }
}

export { getDefaultRetryBackoffStrategy as yx4 }
export { createDefaultRetryToken as $x4 }
