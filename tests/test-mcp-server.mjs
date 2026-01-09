#!/usr/bin/env node
/**
 * Test MCP Server
 *
 * A minimal stdio-based MCP server for testing MCP integration.
 * Provides a few simple tools to verify tool discovery, calling, and results.
 *
 * Usage:
 *   node tests/test-mcp-server.mjs
 *
 * Add to config:
 *   /mcp add test-server node tests/test-mcp-server.mjs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  {
    name: 'test-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
)

// Handle tools/list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Echoes back the provided message. Useful for testing MCP tool calls.',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to echo back' },
          },
          required: ['message'],
        },
      },
      {
        name: 'add',
        description: 'Adds two numbers together.',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' },
          },
          required: ['a', 'b'],
        },
      },
      {
        name: 'server_info',
        description: 'Returns information about this test MCP server.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  }
})

// Handle tools/call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'echo':
      return {
        content: [{ type: 'text', text: args.message }],
      }

    case 'add': {
      const result = (args.a || 0) + (args.b || 0)
      return {
        content: [{ type: 'text', text: String(result) }],
      }
    }

    case 'server_info':
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'test-mcp-server',
              version: '0.1.0',
              tools: ['echo', 'add', 'server_info'],
              uptime: process.uptime(),
              pid: process.pid,
            }, null, 2),
          },
        ],
      }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      }
  }
})

// Handle prompts/list
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'greeting',
        description: 'A simple greeting prompt for testing',
        arguments: [
          { name: 'name', description: 'Name to greet', required: false },
        ],
      },
    ],
  }
})

// Handle prompts/get
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'greeting') {
    const userName = args?.name || 'World'
    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: `Hello, ${userName}! This is a test MCP prompt.` },
        },
      ],
    }
  }

  throw new Error(`Unknown prompt: ${name}`)
})

// Start server
const transport = new StdioServerTransport()
await server.connect(transport)

// Log to stderr (stdout is used for MCP protocol)
console.error('[test-mcp-server] Started and ready for connections')
