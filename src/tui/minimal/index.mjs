/**
 * Minimal TUI - Simple Prompt
 *
 * Basic prompt-based interface without fancy components
 * Lightweight fallback option
 */

import { createInterface } from 'readline'
import { TUI, TUIMetadata } from '../interface.mjs'

/**
 * Minimal TUI Implementation
 */
export class MinimalTUI extends TUI {
  constructor() {
    super()
    this.rl = null
    this.callbacks = {}
  }

  async initialize(options) {
    this.callbacks = {
      onMessage: options.onMessage,
      onCommand: options.onCommand,
      onExit: options.onExit
    }

    // Create readline interface
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    })

    // Handle line input
    this.rl.on('line', (line) => {
      const input = line.trim()

      if (!input) {
        this.rl.prompt()
        return
      }

      // Check if command
      if (input.startsWith('/')) {
        if (this.callbacks.onCommand) {
          this.callbacks.onCommand(input)
        }
      } else {
        if (this.callbacks.onMessage) {
          this.callbacks.onMessage(input)
        }
      }
    })

    // Handle close
    this.rl.on('close', () => {
      if (this.callbacks.onExit) {
        this.callbacks.onExit()
      }
      process.exit(0)
    })

    // Show initial prompt
    this.rl.prompt()

    return this
  }

  async renderMessage(message) {
    if (message.role === 'user') {
      // User messages are already shown via readline
      return
    }

    if (message.role === 'assistant') {
      this.rl.prompt()
    }
  }

  async showToolUse(toolUse) {
  }

  async showToolResult(result) {
    if (result.isError) {
    } else {
    }
    this.rl.prompt()
  }

  async showThinking(content, collapsed = false) {
    if (!collapsed) {
    }
  }

  async showProgress(message) {
    process.stdout.write(`\r${message}...`)
  }

  async hideProgress() {
    process.stdout.write('\r' + ' '.repeat(80) + '\r')
  }

  async updateStatus(status) {
    // Minimal TUI doesn't show status line
  }

  async promptInput() {
    return new Promise((resolve) => {
      this.rl.once('line', (line) => {
        resolve(line.trim())
      })
      this.rl.prompt()
    })
  }

  async showError(error) {
    const message = typeof error === 'string' ? error : error.message
    console.error(`\n✗ Error: ${message}\n`)
    this.rl.prompt()
  }

  async clear() {
    console.clear()
    this.rl.prompt()
  }

  async destroy() {
    if (this.rl) {
      this.rl.close()
      this.rl = null
    }
  }
}

// Set metadata
MinimalTUI.metadata = new TUIMetadata(
  'minimal',
  'Minimal',
  'Simple prompt-based interface',
  '1.0.0'
)

export default MinimalTUI
