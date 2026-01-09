/**
 * Unit test for TUI input handling logic
 * Tests the cursor offset and input value management
 */

import { describe, it, expect, vi } from 'vitest'

describe('Input Handling Logic', () => {
  it('should insert character at cursor position', () => {
    // Simulate the input handler logic
    const input = 'hello'
    const offset = 3  // cursor after 'hel'
    const char = 'X'

    const newValue = input.slice(0, offset) + char + input.slice(offset)
    const newOffset = offset + char.length

    expect(newValue).toBe('helXlo')
    expect(newOffset).toBe(4)
  })

  it('should handle backspace at cursor position', () => {
    const input = 'hello'
    const offset = 3  // cursor after 'hel'

    if (offset > 0) {
      const newValue = input.slice(0, offset - 1) + input.slice(offset)
      const newOffset = offset - 1

      expect(newValue).toBe('helo')
      expect(newOffset).toBe(2)
    }
  })

  it('should handle cursor at end of input', () => {
    const input = 'hello'
    const offset = input.length  // cursor at end
    const char = 'X'

    const newValue = input.slice(0, offset) + char + input.slice(offset)
    expect(newValue).toBe('helloX')
  })

  it('should handle cursor at start of input', () => {
    const input = 'hello'
    const offset = 0  // cursor at start
    const char = 'X'

    const newValue = input.slice(0, offset) + char + input.slice(offset)
    expect(newValue).toBe('Xhello')
  })

  it('should handle newline insertion', () => {
    const input = 'hello world'
    const offset = 5  // after 'hello'

    const newValue = input.slice(0, offset) + '\n' + input.slice(offset)
    expect(newValue).toBe('hello\n world')
  })

  it('should handle / command detection', () => {
    const input = '/help'
    expect(input.startsWith('/')).toBe(true)

    const search = input.slice(1).toLowerCase()
    expect(search).toBe('help')
  })

  it('should handle @ file detection', () => {
    const input = 'look at @src/file.js please'
    const hasAt = input.includes('@')
    const startsWithSlash = input.startsWith('/')

    expect(hasAt).toBe(true)
    expect(startsWithSlash).toBe(false)

    const atIndex = input.lastIndexOf('@')
    const search = input.slice(atIndex + 1).split(' ')[0]
    expect(search).toBe('src/file.js')
  })

  it('should handle mode cycling', () => {
    const STATUS_MODES = {
      ACCEPT_EDITS: 'acceptEdits',
      PLAN: 'plan',
      BYPASS_PERMISSIONS: 'bypassPermissions',
    }

    function getNextMode(current) {
      const modes = Object.values(STATUS_MODES)
      const idx = modes.indexOf(current)
      return modes[(idx + 1) % modes.length]
    }

    expect(getNextMode('acceptEdits')).toBe('plan')
    expect(getNextMode('plan')).toBe('bypassPermissions')
    expect(getNextMode('bypassPermissions')).toBe('acceptEdits')
  })

  it('should use ref to avoid stale closure in rapid input', () => {
    // Simulate rapid input scenario where state hasn't updated yet
    let inputRef = { current: '' }
    let cursorOffsetRef = { current: 0 }

    // Simulate typing 'abc' rapidly
    const chars = ['a', 'b', 'c']

    chars.forEach(char => {
      // Using ref.current (correct - always has latest value)
      const offset = cursorOffsetRef.current
      const currentInput = inputRef.current
      const newValue = currentInput.slice(0, offset) + char + currentInput.slice(offset)
      inputRef.current = newValue  // Update ref synchronously
      cursorOffsetRef.current = offset + 1
    })

    expect(inputRef.current).toBe('abc')
    expect(cursorOffsetRef.current).toBe(3)
  })

  it('should handle backspace with refs correctly', () => {
    let inputRef = { current: 'hello' }
    let cursorOffsetRef = { current: 5 }  // cursor at end

    // Backspace 3 times rapidly
    for (let i = 0; i < 3; i++) {
      const offset = cursorOffsetRef.current
      const currentInput = inputRef.current
      if (offset > 0) {
        const newValue = currentInput.slice(0, offset - 1) + currentInput.slice(offset)
        inputRef.current = newValue
        cursorOffsetRef.current = offset - 1
      }
    }

    expect(inputRef.current).toBe('he')
    expect(cursorOffsetRef.current).toBe(2)
  })

  it('should handle mixed typing and backspace', () => {
    let inputRef = { current: '' }
    let cursorOffsetRef = { current: 0 }

    // Type 'hello'
    'hello'.split('').forEach(char => {
      const offset = cursorOffsetRef.current
      const currentInput = inputRef.current
      inputRef.current = currentInput.slice(0, offset) + char + currentInput.slice(offset)
      cursorOffsetRef.current = offset + 1
    })

    expect(inputRef.current).toBe('hello')

    // Backspace twice
    for (let i = 0; i < 2; i++) {
      const offset = cursorOffsetRef.current
      const currentInput = inputRef.current
      if (offset > 0) {
        inputRef.current = currentInput.slice(0, offset - 1) + currentInput.slice(offset)
        cursorOffsetRef.current = offset - 1
      }
    }

    expect(inputRef.current).toBe('hel')

    // Type 'p me'
    'p me'.split('').forEach(char => {
      const offset = cursorOffsetRef.current
      const currentInput = inputRef.current
      inputRef.current = currentInput.slice(0, offset) + char + currentInput.slice(offset)
      cursorOffsetRef.current = offset + 1
    })

    expect(inputRef.current).toBe('help me')
  })
})
