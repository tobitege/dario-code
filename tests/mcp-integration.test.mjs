/**
 * MCP Integration Tests
 *
 * Tests the full MCP flow:
 * - Connecting to a test MCP server
 * - Discovering tools
 * - Calling tools
 * - Wrapping tools for the executor
 * - Getting system instructions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ListToolsResultSchema, ListPromptsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_SERVER_PATH = path.join(__dirname, 'test-mcp-server.mjs')

describe('MCP Integration', () => {
  let client
  let transport

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'node',
      args: [TEST_SERVER_PATH],
      env: process.env,
      stderr: 'pipe',
    })

    client = new Client(
      { name: 'test-client', version: '0.1.0' },
      { capabilities: {} }
    )

    await client.connect(transport)
  }, 10000)

  afterAll(async () => {
    try {
      await client?.close()
    } catch {}
  })

  describe('Tool Discovery', () => {
    it('lists available tools', async () => {
      const result = await client.request(
        { method: 'tools/list' },
        ListToolsResultSchema
      )

      expect(result.tools).toBeDefined()
      expect(result.tools.length).toBe(3)

      const names = result.tools.map(t => t.name)
      expect(names).toContain('echo')
      expect(names).toContain('add')
      expect(names).toContain('server_info')
    })

    it('tools have proper schemas', async () => {
      const result = await client.request(
        { method: 'tools/list' },
        ListToolsResultSchema
      )

      const echoTool = result.tools.find(t => t.name === 'echo')
      expect(echoTool.description).toContain('Echoes back')
      expect(echoTool.inputSchema.properties.message).toBeDefined()
      expect(echoTool.inputSchema.required).toContain('message')
    })
  })

  describe('Tool Execution', () => {
    it('echo tool returns the message', async () => {
      const result = await client.callTool(
        { name: 'echo', arguments: { message: 'hello MCP' } },
        CallToolResultSchema
      )

      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toBe('hello MCP')
    })

    it('add tool computes correctly', async () => {
      const result = await client.callTool(
        { name: 'add', arguments: { a: 17, b: 25 } },
        CallToolResultSchema
      )

      expect(result.content[0].text).toBe('42')
    })

    it('server_info returns valid JSON', async () => {
      const result = await client.callTool(
        { name: 'server_info', arguments: {} },
        CallToolResultSchema
      )

      const info = JSON.parse(result.content[0].text)
      expect(info.name).toBe('test-mcp-server')
      expect(info.version).toBe('0.1.0')
      expect(info.tools).toContain('echo')
    })

    it('unknown tool returns error', async () => {
      const result = await client.callTool(
        { name: 'nonexistent', arguments: {} },
        CallToolResultSchema
      )

      expect(result.isError).toBe(true)
    })
  })

  describe('Prompt Discovery', () => {
    it('lists available prompts', async () => {
      const result = await client.request(
        { method: 'prompts/list' },
        ListPromptsResultSchema
      )

      expect(result.prompts).toBeDefined()
      expect(result.prompts.length).toBe(1)
      expect(result.prompts[0].name).toBe('greeting')
    })

    it('gets a prompt with arguments', async () => {
      const result = await client.getPrompt({
        name: 'greeting',
        arguments: { name: 'Test' },
      })

      expect(result.messages).toBeDefined()
      expect(result.messages[0].content.text).toContain('Hello, Test')
    })

    it('gets a prompt with default argument', async () => {
      const result = await client.getPrompt({
        name: 'greeting',
        arguments: {},
      })

      expect(result.messages[0].content.text).toContain('Hello, World')
    })
  })
})

describe('MCP Tool Wrapper', () => {
  it('wraps MCP tools into executor-compatible format', async () => {
    const { wrapMcpToolsForExecutor } = await import('../src/integration/mcp.mjs')

    // Mock MCP tool definitions
    const mcpTools = [
      {
        name: 'mcp__test__echo',
        description: 'Echo tool',
        inputJSONSchema: { type: 'object', properties: { message: { type: 'string' } } },
        serverName: 'test',
        toolName: 'echo',
      },
    ]

    // Mock client info (not actually connected, just for wrapping test)
    const clientInfos = [
      { name: 'test', type: 'connected', client: { callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }) } },
    ]

    const wrapped = wrapMcpToolsForExecutor(mcpTools, clientInfos, {
      logMcpServerMessage: () => {},
    })

    expect(wrapped.length).toBe(1)
    expect(wrapped[0].name).toBe('mcp__test__echo')
    expect(typeof wrapped[0].call).toBe('function')
    expect(wrapped[0].needsPermissions()).toBe(true)
    expect(wrapped[0].userFacingName()).toBe('mcp__test__echo')
  })

  it('skips tools for disconnected servers', async () => {
    const { wrapMcpToolsForExecutor } = await import('../src/integration/mcp.mjs')

    const mcpTools = [
      { name: 'mcp__bad__tool', serverName: 'bad', toolName: 'tool' },
    ]

    const clientInfos = [
      { name: 'bad', type: 'failed' },
    ]

    const wrapped = wrapMcpToolsForExecutor(mcpTools, clientInfos, {})
    expect(wrapped.length).toBe(0)
  })
})
