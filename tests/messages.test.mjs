import { describe, it, expect } from 'vitest'
import { createMessage, normalizeMessages } from '../src/utils/messages.mjs'

describe('normalizeMessages', () => {
  it('generates unique UUIDs for expanded tool_result messages', () => {
    const userMsg = {
      type: 'user',
      uuid: 'original-uuid',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: 'result 1',
          },
          {
            type: 'tool_result',
            tool_use_id: 'tool-2',
            content: 'result 2',
          },
        ],
      },
    }

    const normalized = normalizeMessages([userMsg])

    // Should expand to 4 messages (2 tool_use + 2 tool_result)
    expect(normalized).toHaveLength(4)

    // Extract all UUIDs
    const uuids = normalized.map((m) => m.uuid)

    // All UUIDs must be unique
    const uniqueUuids = new Set(uuids)
    expect(uniqueUuids.size).toBe(4)

    // None should be the original UUID
    expect(uuids).not.toContain('original-uuid')
  })

  it('preserves UUID for non-expanded messages', () => {
    const msg = createMessage('user', 'Hello')
    const normalized = normalizeMessages([msg])

    expect(normalized).toHaveLength(1)
    expect(normalized[0].uuid).toBe(msg.uuid)
  })

  it('creates synthetic tool_use messages with name="unknown"', () => {
    const userMsg = {
      type: 'user',
      uuid: 'original-uuid',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: 'result 1',
          },
        ],
      },
    }

    const normalized = normalizeMessages([userMsg])

    // Should have 2 messages: synthetic tool_use + tool_result
    expect(normalized).toHaveLength(2)

    // First message should be synthetic assistant with unknown tool name
    expect(normalized[0].type).toBe('assistant')
    expect(normalized[0].message.content[0].name).toBe('unknown')
  })
})
