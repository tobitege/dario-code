/**
 * TUI Interface Contract
 *
 * All TUI implementations must implement this interface to ensure
 * they can be swapped via the loader system.
 */

/**
 * Base TUI interface that all implementations must follow
 *
 * @interface TUI
 */
export class TUI {
  /**
   * Initialize the TUI
   * @param {Object} options - Initialization options
   * @param {Function} options.onMessage - Callback when user sends a message
   * @param {Function} options.onCommand - Callback when user runs a command
   * @param {Function} options.onExit - Callback when user exits
   */
  async initialize(options) {
    throw new Error('TUI.initialize() must be implemented')
  }

  /**
   * Render a message to the TUI
   * @param {Object} message - Message object
   * @param {string} message.role - 'user' or 'assistant'
   * @param {string|Array} message.content - Message content
   */
  async renderMessage(message) {
    throw new Error('TUI.renderMessage() must be implemented')
  }

  /**
   * Show tool use in progress
   * @param {Object} toolUse - Tool use information
   * @param {string} toolUse.name - Tool name
   * @param {Object} toolUse.input - Tool input
   * @param {string} toolUse.id - Tool use ID
   */
  async showToolUse(toolUse) {
    throw new Error('TUI.showToolUse() must be implemented')
  }

  /**
   * Show tool result
   * @param {Object} result - Tool result
   * @param {string} result.toolUseId - Tool use ID
   * @param {string|Array} result.content - Result content
   * @param {boolean} result.isError - Whether result is an error
   */
  async showToolResult(result) {
    throw new Error('TUI.showToolResult() must be implemented')
  }

  /**
   * Show thinking block
   * @param {string} content - Thinking content
   * @param {boolean} collapsed - Whether block is collapsed
   */
  async showThinking(content, collapsed = false) {
    throw new Error('TUI.showThinking() must be implemented')
  }

  /**
   * Show progress indicator
   * @param {string} message - Progress message
   */
  async showProgress(message) {
    throw new Error('TUI.showProgress() must be implemented')
  }

  /**
   * Hide progress indicator
   */
  async hideProgress() {
    throw new Error('TUI.hideProgress() must be implemented')
  }

  /**
   * Update status line
   * @param {Object} status - Status information
   * @param {string} status.model - Current model
   * @param {number} status.tokenUsage - Token usage
   * @param {string} status.mode - Current mode
   */
  async updateStatus(status) {
    throw new Error('TUI.updateStatus() must be implemented')
  }

  /**
   * Prompt user for input
   * @returns {Promise<string>} User input
   */
  async promptInput() {
    throw new Error('TUI.promptInput() must be implemented')
  }

  /**
   * Show error message
   * @param {string|Error} error - Error to display
   */
  async showError(error) {
    throw new Error('TUI.showError() must be implemented')
  }

  /**
   * Clear the screen
   */
  async clear() {
    throw new Error('TUI.clear() must be implemented')
  }

  /**
   * Destroy the TUI and cleanup
   */
  async destroy() {
    throw new Error('TUI.destroy() must be implemented')
  }
}

/**
 * TUI metadata for discovery and selection
 */
export class TUIMetadata {
  constructor(id, name, description, version) {
    this.id = id
    this.name = name
    this.description = description
    this.version = version
  }
}

export default TUI
