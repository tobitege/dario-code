/**
 * Keyboard configuration module
 * Loads and manages keyboard settings
 */

import fs from 'fs'
import path from 'path'
import { getConfigPath, getConfigDir } from '../config/paths.mjs'

const DEFAULT_CONFIG = {
  keyboard: {
    mode: 'normal',
    enabled: true,
    shortcuts: {
      historySearch: 'ctrl+r',
      suspend: 'ctrl+z',
      toggleThinking: 'tab',
      cycleMode: 'shift+tab'
    },
    emacs: {
      enabled: true,
      bindings: {
        beginLine: 'ctrl+a',
        endLine: 'ctrl+e',
        killLine: 'ctrl+k',
        killStart: 'ctrl+u',
        deleteWord: 'ctrl+w',
        forwardWord: 'alt+f',
        backwardWord: 'alt+b'
      }
    },
    vim: {
      enabled: false,
      bindings: {
        normalMode: 'esc',
        insertMode: 'i',
        delete: 'dd',
        copy: 'yy',
        paste: 'p',
        deleteChar: 'x',
        exit: ':q'
      }
    }
  }
}

class KeyboardConfig {
  constructor() {
    this.config = structuredClone(DEFAULT_CONFIG)
    this.configPath = getConfigPath()
    this.loaded = false
  }

  /**
   * Load configuration from file
   */
  load() {
    try {
      const configDir = getConfigDir()

      // Create config directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      // Try to load existing config
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf8')
        const loaded = JSON.parse(content)

        // Merge with defaults
        this.config = this.deepMerge(DEFAULT_CONFIG, loaded)
      } else {
        // Save default config
        this.save()
      }

      this.loaded = true
      return this.config
    } catch (error) {
      console.error(`Failed to load keyboard config: ${error.message}`)
      return this.config
    }
  }

  /**
   * Save configuration to file
   */
  save() {
    try {
      const configDir = getConfigDir()

      // Create config directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      )
      return true
    } catch (error) {
      console.error(`Failed to save keyboard config: ${error.message}`)
      return false
    }
  }

  /**
   * Get keyboard configuration
   */
  getKeyboardConfig() {
    return this.config.keyboard
  }

  /**
   * Set keyboard mode
   */
  setMode(mode) {
    if (!['normal', 'vim', 'emacs'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`)
    }
    this.config.keyboard.mode = mode
    this.save()
    return mode
  }

  /**
   * Get keyboard mode
   */
  getMode() {
    return this.config.keyboard.mode
  }

  /**
   * Check if keyboard shortcuts are enabled
   */
  isEnabled() {
    return this.config.keyboard.enabled
  }

  /**
   * Enable/disable keyboard shortcuts
   */
  setEnabled(enabled) {
    this.config.keyboard.enabled = enabled
    this.save()
    return enabled
  }

  /**
   * Get keyboard shortcut mapping
   */
  getShortcuts() {
    return this.config.keyboard.shortcuts
  }

  /**
   * Get emacs bindings
   */
  getEmacsBindings() {
    return this.config.keyboard.emacs.bindings
  }

  /**
   * Check if emacs mode is enabled
   */
  isEmacsEnabled() {
    return this.config.keyboard.emacs.enabled
  }

  /**
   * Get vim bindings
   */
  getVimBindings() {
    return this.config.keyboard.vim.bindings
  }

  /**
   * Check if vim mode is enabled
   */
  isVimEnabled() {
    return this.config.keyboard.vim.enabled
  }

  /**
   * Deep merge objects for configuration merging
   */
  deepMerge(target, source) {
    const output = structuredClone(target)

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          output[key] = this.deepMerge(output[key] || {}, source[key])
        } else {
          output[key] = source[key]
        }
      }
    }

    return output
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults() {
    this.config = structuredClone(DEFAULT_CONFIG)
    this.save()
    return this.config
  }

  /**
   * Get full configuration object
   */
  getConfig() {
    return this.config
  }
}

// Export singleton instance
export const keyboardConfig = new KeyboardConfig()

/**
 * Initialize keyboard configuration
 */
export function initializeKeyboardConfig() {
  return keyboardConfig.load()
}
