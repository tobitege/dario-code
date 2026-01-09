/**
 * Tests for keyboard module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { keyboardManager } from '../src/keyboard/index.mjs'
import { keyboardConfig } from '../src/keyboard/config.mjs'
import { historySearch } from '../src/keyboard/history-search.mjs'
import { suspendManager } from '../src/keyboard/suspend.mjs'
import { vimMode } from '../src/keyboard/vim-mode.mjs'

describe('KeyboardManager', () => {
  beforeEach(() => {
    keyboardManager.mode = 'normal'
    keyboardManager.vimMode = false
    keyboardManager.emacsMode = false
    keyboardManager.history = []
  })

  it('should initialize keyboard manager', () => {
    expect(keyboardManager).toBeDefined()
    expect(keyboardManager.mode).toBe('normal')
  })

  it('should detect Ctrl+R key combination', () => {
    const handleSpy = vi.spyOn(keyboardManager, 'emit')
    const result = keyboardManager.handleSpecialKeys('\x12')
    expect(result).toBe(true)
    expect(handleSpy).toHaveBeenCalledWith('history-search')
  })

  it('should detect Ctrl+Z key combination', () => {
    const handleSpy = vi.spyOn(keyboardManager, 'emit')
    const result = keyboardManager.handleSpecialKeys('\x1a')
    expect(result).toBe(true)
    expect(handleSpy).toHaveBeenCalledWith('suspend')
  })

  it('should detect Ctrl+A in emacs mode', () => {
    keyboardManager.emacsMode = true
    const handleSpy = vi.spyOn(keyboardManager, 'emit')
    const result = keyboardManager.handleSpecialKeys('\x01')
    expect(result).toBe(true)
    expect(handleSpy).toHaveBeenCalledWith('emacs-begin-line')
  })

  it('should set keyboard mode', () => {
    keyboardManager.setMode('vim')
    expect(keyboardManager.mode).toBe('vim')
    expect(keyboardManager.vimMode).toBe(true)

    keyboardManager.setMode('emacs')
    expect(keyboardManager.mode).toBe('emacs')
    expect(keyboardManager.emacsMode).toBe(true)

    keyboardManager.setMode('normal')
    expect(keyboardManager.mode).toBe('normal')
    expect(keyboardManager.vimMode).toBe(false)
    expect(keyboardManager.emacsMode).toBe(false)
  })

  it('should add to history', () => {
    keyboardManager.addToHistory('test command 1')
    keyboardManager.addToHistory('test command 2')
    expect(keyboardManager.history.length).toBe(2)
    expect(keyboardManager.history[0]).toBe('test command 1')
  })

  it('should search history', () => {
    keyboardManager.addToHistory('list files')
    keyboardManager.addToHistory('list directories')
    keyboardManager.addToHistory('grep pattern')

    const results = keyboardManager.searchHistory('list')
    expect(results.length).toBe(2)
    expect(results[0]).toBe('list files')
  })
})

describe('KeyboardConfig', () => {
  it('should load default config', () => {
    const config = keyboardConfig.getConfig()
    expect(config).toBeDefined()
    expect(config.keyboard).toBeDefined()
    expect(config.keyboard.mode).toBe('normal')
  })

  it('should set keyboard mode', () => {
    const mode = keyboardConfig.setMode('vim')
    expect(mode).toBe('vim')
    expect(keyboardConfig.getMode()).toBe('vim')
  })

  it('should get keyboard shortcuts', () => {
    const shortcuts = keyboardConfig.getShortcuts()
    expect(shortcuts).toBeDefined()
    expect(shortcuts.historySearch).toBe('ctrl+r')
    expect(shortcuts.suspend).toBe('ctrl+z')
  })

  it('should enable/disable keyboard shortcuts', () => {
    keyboardConfig.setEnabled(false)
    expect(keyboardConfig.isEnabled()).toBe(false)

    keyboardConfig.setEnabled(true)
    expect(keyboardConfig.isEnabled()).toBe(true)
  })

  it('should get emacs bindings', () => {
    const bindings = keyboardConfig.getEmacsBindings()
    expect(bindings).toBeDefined()
    expect(bindings.beginLine).toBe('ctrl+a')
    expect(bindings.endLine).toBe('ctrl+e')
  })

  it('should get vim bindings', () => {
    const bindings = keyboardConfig.getVimBindings()
    expect(bindings).toBeDefined()
    expect(bindings.normalMode).toBe('esc')
    expect(bindings.insertMode).toBe('i')
  })

  it('should reset to defaults', () => {
    keyboardConfig.setMode('vim')
    expect(keyboardConfig.getMode()).toBe('vim')

    keyboardConfig.resetToDefaults()
    expect(keyboardConfig.getMode()).toBe('normal')
  })
})

describe('HistorySearch', () => {
  beforeEach(() => {
    historySearch.init([
      'list files',
      'change directory',
      'list directories',
      'show help'
    ])
  })

  it('should initialize history search', () => {
    expect(historySearch.isActive()).toBe(false)
  })

  it('should start search', () => {
    historySearch.start(null, null, null, null)
    expect(historySearch.isActive()).toBe(true)
  })

  it('should perform search', () => {
    historySearch.start(null, null, null, null)
    historySearch.addChar('l')
    historySearch.addChar('i')
    historySearch.addChar('s')
    historySearch.addChar('t')

    expect(historySearch.searchQuery).toBe('list')
    expect(historySearch.searchResults.length).toBe(2)
  })

  it('should backspace in search', () => {
    historySearch.start(null, null, null, null)
    historySearch.addChar('l')
    historySearch.addChar('i')
    historySearch.addChar('s')
    historySearch.backspace()

    expect(historySearch.searchQuery).toBe('li')
  })

  it('should navigate results', () => {
    historySearch.start(null, null, null, null)
    historySearch.addChar('l')
    expect(historySearch.currentIndex).toBe(0)

    historySearch.nextResult()
    expect(historySearch.currentIndex).toBe(1)

    historySearch.previousResult()
    expect(historySearch.currentIndex).toBe(0)
  })

  it('should select current result', () => {
    historySearch.start(null, null, null, null)
    historySearch.addChar('c')
    historySearch.addChar('h')
    historySearch.addChar('a')
    historySearch.addChar('n')
    historySearch.addChar('g')
    historySearch.addChar('e')

    const selected = historySearch.selectCurrent()
    expect(selected).toBe('change directory')
    expect(historySearch.isActive()).toBe(false)
  })

  it('should cancel search', () => {
    historySearch.start(null, null, null, null)
    historySearch.addChar('l')
    expect(historySearch.isActive()).toBe(true)

    historySearch.cancel()
    expect(historySearch.isActive()).toBe(false)
    expect(historySearch.searchQuery).toBe('')
  })
})

describe('SuspendManager', () => {
  beforeEach(() => {
    suspendManager.suspendedOperations = []
    suspendManager.operationCounter = 0
  })

  it('should suspend operation', () => {
    const id = suspendManager.suspend('curl api.example.com')
    expect(id).toBe(0)
    expect(suspendManager.getCount()).toBe(1)
  })

  it('should list suspended operations', () => {
    suspendManager.suspend('download file')
    suspendManager.suspend('process data')
    const operations = suspendManager.list()
    expect(operations.length).toBe(2)
  })

  it('should resume operation', () => {
    const id = suspendManager.suspend('long running task')
    const resumed = suspendManager.resume(id)
    expect(resumed).toBeDefined()
    expect(suspendManager.getCount()).toBe(0)
  })

  it('should resume latest operation', () => {
    suspendManager.suspend('task 1')
    suspendManager.suspend('task 2')
    const resumed = suspendManager.resumeLatest()
    expect(resumed.operation).toBe('task 2')
    expect(suspendManager.getCount()).toBe(1)
  })

  it('should resume all operations', () => {
    suspendManager.suspend('task 1')
    suspendManager.suspend('task 2')
    suspendManager.suspend('task 3')
    const resumed = suspendManager.resumeAll()
    expect(resumed.length).toBe(3)
    expect(suspendManager.getCount()).toBe(0)
  })

  it('should kill operation', () => {
    const id = suspendManager.suspend('dangerous task')
    const killed = suspendManager.kill(id)
    expect(killed).toBe(true)
    expect(suspendManager.getCount()).toBe(0)
  })

  it('should check if operations are suspended', () => {
    expect(suspendManager.hasSuspended()).toBe(false)
    suspendManager.suspend('task')
    expect(suspendManager.hasSuspended()).toBe(true)
  })
})

describe('VimMode', () => {
  beforeEach(() => {
    vimMode.disable()
    vimMode.buffer = ''
    vimMode.cursor = 0
  })

  it('should enable vim mode', () => {
    vimMode.enable()
    expect(vimMode.enabled).toBe(true)
    expect(vimMode.insertMode).toBe(true)
  })

  it('should switch to normal mode', () => {
    vimMode.enable()
    vimMode.switchToNormalMode()
    expect(vimMode.normalMode).toBe(true)
    expect(vimMode.insertMode).toBe(false)
  })

  it('should switch to insert mode', () => {
    vimMode.enable()
    vimMode.switchToNormalMode()
    vimMode.switchToInsertMode()
    expect(vimMode.insertMode).toBe(true)
    expect(vimMode.normalMode).toBe(false)
  })

  it('should insert text in insert mode', () => {
    vimMode.enable()
    vimMode.insertText('hello')
    expect(vimMode.buffer).toBe('hello')
    expect(vimMode.cursor).toBe(5)
  })

  it('should delete backward', () => {
    vimMode.enable()
    vimMode.insertText('hello')
    vimMode.deleteBackward()
    expect(vimMode.buffer).toBe('hell')
  })

  it('should handle normal mode navigation', () => {
    vimMode.enable()
    vimMode.switchToNormalMode()
    vimMode.buffer = 'hello world'
    vimMode.cursor = 5

    vimMode.handleNormalModeKey('h')
    expect(vimMode.cursor).toBe(4)

    vimMode.handleNormalModeKey('l')
    expect(vimMode.cursor).toBe(5)
  })

  it('should copy and paste in vim', () => {
    vimMode.enable()
    vimMode.switchToNormalMode()
    vimMode.buffer = 'test'
    vimMode.handleNormalModeKey('y')
    expect(vimMode.clipboard).toBe('test')

    vimMode.buffer = ''
    vimMode.cursor = 0
    vimMode.handleNormalModeKey('p')
    expect(vimMode.buffer).toBe('test')
  })

  it('should get vim status', () => {
    vimMode.enable()
    const status = vimMode.getStatus()
    expect(status.enabled).toBe(true)
    expect(status.mode).toBe('insert')
  })
})
