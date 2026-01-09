/**
 * Vim mode implementation
 * Provides vim-like keybindings and editing
 */

class VimMode {
  constructor() {
    this.enabled = false
    this.normalMode = false
    this.insertMode = true
    this.commandMode = false
    this.buffer = ''
    this.cursor = 0
    this.clipboard = ''
    this.command = ''
    this.operationCallbacks = {
      onModeChange: null,
      onInput: null,
      onCommand: null,
      onDelete: null,
      onNavigate: null
    }
  }

  /**
   * Enable vim mode
   */
  enable() {
    this.enabled = true
    this.normalMode = false
    this.insertMode = true
    this.commandMode = false

    if (this.operationCallbacks.onModeChange) {
      this.operationCallbacks.onModeChange('insert')
    }
  }

  /**
   * Disable vim mode
   */
  disable() {
    this.enabled = false
    this.normalMode = false
    this.insertMode = false
    this.commandMode = false
  }

  /**
   * Register operation callbacks
   */
  onModeChange(callback) {
    this.operationCallbacks.onModeChange = callback
  }

  onInput(callback) {
    this.operationCallbacks.onInput = callback
  }

  onCommand(callback) {
    this.operationCallbacks.onCommand = callback
  }

  onDelete(callback) {
    this.operationCallbacks.onDelete = callback
  }

  onNavigate(callback) {
    this.operationCallbacks.onNavigate = callback
  }

  /**
   * Switch to normal mode
   */
  switchToNormalMode() {
    this.insertMode = false
    this.normalMode = true
    this.commandMode = false

    if (this.operationCallbacks.onModeChange) {
      this.operationCallbacks.onModeChange('normal')
    }
  }

  /**
   * Switch to insert mode
   */
  switchToInsertMode() {
    this.insertMode = true
    this.normalMode = false
    this.commandMode = false

    if (this.operationCallbacks.onModeChange) {
      this.operationCallbacks.onModeChange('insert')
    }
  }

  /**
   * Switch to command mode
   */
  switchToCommandMode() {
    this.normalMode = false
    this.insertMode = false
    this.commandMode = true

    if (this.operationCallbacks.onModeChange) {
      this.operationCallbacks.onModeChange('command')
    }
  }

  /**
   * Handle key in normal mode
   */
  handleNormalModeKey(key) {
    if (!this.normalMode) return false

    switch (key) {
      // Enter insert mode
      case 'i':
        this.switchToInsertMode()
        return true

      case 'a':
        // Append mode (cursor after character)
        if (this.cursor < this.buffer.length) {
          this.cursor++
        }
        this.switchToInsertMode()
        return true

      // Navigation
      case 'h':
        this.moveCursorLeft()
        return true

      case 'l':
        this.moveCursorRight()
        return true

      case 'w':
        this.moveWordForward()
        return true

      case 'b':
        this.moveWordBackward()
        return true

      case 'e':
        this.moveEndOfWord()
        return true

      case '0':
        this.cursor = 0
        return true

      case '$':
        this.cursor = this.buffer.length
        return true

      // Edit operations
      case 'x':
        // Delete character at cursor
        this.deleteAtCursor()
        return true

      case 'd':
        // Delete line
        this.buffer = ''
        this.cursor = 0
        if (this.operationCallbacks.onDelete) {
          this.operationCallbacks.onDelete('line', this.buffer)
        }
        return true

      case 'y':
        // Yank (copy) line
        this.clipboard = this.buffer
        return true

      case 'p':
        // Paste
        this.insertText(this.clipboard)
        return true

      case ':':
        // Enter command mode
        this.switchToCommandMode()
        this.command = ':'
        return true

      case 'u':
        // Undo (not fully implemented)
        return true

      case 'ctrl+r':
        // Redo (not fully implemented)
        return true

      default:
        return false
    }
  }

  /**
   * Handle key in insert mode
   */
  handleInsertModeKey(key) {
    if (!this.insertMode) return false

    if (key === '\x1b') {
      // ESC to normal mode
      this.switchToNormalMode()
      return true
    } else if (key === '\x08' || key === '\x7f') {
      // BACKSPACE
      this.deleteBackward()
      return true
    } else if (key === '\t') {
      // Tab
      this.insertText('  ')
      return true
    } else if (key >= ' ' && key <= '~') {
      // Printable character
      this.insertText(key)
      return true
    }

    return false
  }

  /**
   * Handle key in command mode
   */
  handleCommandModeKey(key) {
    if (!this.commandMode) return false

    if (key === '\r' || key === '\n') {
      // Execute command
      this.executeCommand(this.command)
      this.command = ''
      this.switchToNormalMode()
      return true
    } else if (key === '\x1b') {
      // ESC to normal mode
      this.command = ''
      this.switchToNormalMode()
      return true
    } else if (key === '\x08' || key === '\x7f') {
      // BACKSPACE
      if (this.command.length > 1) {
        this.command = this.command.slice(0, -1)
      }
      return true
    } else if (key >= ' ' && key <= '~') {
      // Printable character
      this.command += key
      return true
    }

    return false
  }

  /**
   * Execute vim command
   */
  executeCommand(command) {
    if (this.operationCallbacks.onCommand) {
      this.operationCallbacks.onCommand(command)
    }

    // Handle basic commands
    if (command === ':q' || command === ':quit') {
      process.exit(0)
    } else if (command === ':w' || command === ':write') {
      // Save would be handled by application
      return 'Saved'
    } else if (command.startsWith(':set ')) {
      const mode = command.slice(5).trim()
      if (['normal', 'insert', 'vim', 'emacs'].includes(mode)) {
        return `Mode set to ${mode}`
      }
    }
  }

  /**
   * Insert text at cursor
   */
  insertText(text) {
    this.buffer = this.buffer.slice(0, this.cursor) + text + this.buffer.slice(this.cursor)
    this.cursor += text.length

    if (this.operationCallbacks.onInput) {
      this.operationCallbacks.onInput(this.buffer, this.cursor)
    }
  }

  /**
   * Delete backward (backspace)
   */
  deleteBackward() {
    if (this.cursor > 0) {
      this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor)
      this.cursor--

      if (this.operationCallbacks.onInput) {
        this.operationCallbacks.onInput(this.buffer, this.cursor)
      }
    }
  }

  /**
   * Delete character at cursor
   */
  deleteAtCursor() {
    if (this.cursor < this.buffer.length) {
      this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1)

      if (this.operationCallbacks.onDelete) {
        this.operationCallbacks.onDelete('char', this.buffer)
      }
    }
  }

  /**
   * Move cursor left
   */
  moveCursorLeft() {
    if (this.cursor > 0) {
      this.cursor--

      if (this.operationCallbacks.onNavigate) {
        this.operationCallbacks.onNavigate('left', this.cursor)
      }
    }
  }

  /**
   * Move cursor right
   */
  moveCursorRight() {
    if (this.cursor < this.buffer.length) {
      this.cursor++

      if (this.operationCallbacks.onNavigate) {
        this.operationCallbacks.onNavigate('right', this.cursor)
      }
    }
  }

  /**
   * Move cursor to next word
   */
  moveWordForward() {
    while (this.cursor < this.buffer.length && this.buffer[this.cursor] === ' ') {
      this.cursor++
    }
    while (this.cursor < this.buffer.length && this.buffer[this.cursor] !== ' ') {
      this.cursor++
    }

    if (this.operationCallbacks.onNavigate) {
      this.operationCallbacks.onNavigate('word-forward', this.cursor)
    }
  }

  /**
   * Move cursor to previous word
   */
  moveWordBackward() {
    if (this.cursor > 0) {
      this.cursor--
    }
    while (this.cursor > 0 && this.buffer[this.cursor] === ' ') {
      this.cursor--
    }
    while (this.cursor > 0 && this.buffer[this.cursor - 1] !== ' ') {
      this.cursor--
    }

    if (this.operationCallbacks.onNavigate) {
      this.operationCallbacks.onNavigate('word-backward', this.cursor)
    }
  }

  /**
   * Move cursor to end of word
   */
  moveEndOfWord() {
    while (this.cursor < this.buffer.length && this.buffer[this.cursor] !== ' ') {
      this.cursor++
    }

    if (this.operationCallbacks.onNavigate) {
      this.operationCallbacks.onNavigate('end-of-word', this.cursor)
    }
  }

  /**
   * Get current mode
   */
  getMode() {
    if (this.insertMode) return 'insert'
    if (this.normalMode) return 'normal'
    if (this.commandMode) return 'command'
    return 'unknown'
  }

  /**
   * Get vim status for display
   */
  getStatus() {
    return {
      enabled: this.enabled,
      mode: this.getMode(),
      buffer: this.buffer,
      cursor: this.cursor,
      command: this.command
    }
  }
}

// Export singleton instance
export const vimMode = new VimMode()
