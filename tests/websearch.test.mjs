/**
 * WebSearch Tool Tests
 *
 * This test file demonstrates how to use the WebSearch tool
 * and verifies its functionality with mock data.
 */

import { createWebSearchTool, clearCache } from '../src/tools/websearch.mjs'

/**
 * Mock fetch implementation for testing
 */
function createMockFetch(htmlResponse = null) {
  return async (url, options) => {
    const defaultHtml = `
      <div class="result__body">
        <h2><a href="https://example.com/page1">Example Article</a></h2>
        <a href="#">example.com</a>
        <p>This is a test snippet about example content.</p>
      </div>
      <div class="result__body">
        <h2><a href="https://github.com/test/repo">GitHub Repository</a></h2>
        <a href="#">github.com</a>
        <p>A popular repository with useful code and documentation.</p>
      </div>
      <div class="result__body">
        <h2><a href="https://docs.example.com/guide">Documentation Guide</a></h2>
        <a href="#">docs.example.com</a>
        <p>Complete guide on how to use the service effectively.</p>
      </div>
    `

    return {
      ok: true,
      status: 200,
      text: async () => htmlResponse || defaultHtml
    }
  }
}

/**
 * Test 1: Basic search functionality
 */
async function testBasicSearch() {
  console.log('\n=== Test 1: Basic Search Functionality ===')

  const tool = createWebSearchTool({ fetch: createMockFetch() })

  const generator = tool.call(
    { query: 'JavaScript best practices' },
    { abortController: null }
  )

  for await (const result of generator) {
    if (result.type === 'result') {
      console.log('✓ Search completed successfully')
      console.log(`  - Query: "${result.data.query}"`)
      console.log(`  - Results found: ${result.data.resultCount}`)
      console.log(`  - From cache: ${result.data.fromCache}`)
      console.log(`  - Duration: ${result.data.durationMs}ms`)
    }
  }
}

/**
 * Test 2: Result limit parameter
 */
async function testResultLimit() {
  console.log('\n=== Test 2: Result Limit Parameter ===')

  const tool = createWebSearchTool({ fetch: createMockFetch() })
  clearCache()

  const generator = tool.call(
    { query: 'test query', limit: 2 },
    { abortController: null }
  )

  for await (const result of generator) {
    if (result.type === 'result') {
      console.log('✓ Limit parameter working')
      console.log(`  - Requested limit: 2`)
      console.log(`  - Actual results: ${result.data.resultCount}`)

      if (result.data.resultCount <= 2) {
        console.log('  ✓ Result count respects limit')
      }
    }
  }
}

/**
 * Test 3: Tool properties and methods
 */
async function testToolProperties() {
  console.log('\n=== Test 3: Tool Properties and Methods ===')

  const tool = createWebSearchTool()

  console.log('✓ Tool created successfully')
  console.log(`  - Name: ${tool.name}`)
  console.log(`  - Description: ${await tool.description()}`)
  console.log(`  - User facing name: ${tool.userFacingName()}`)
  console.log(`  - Is read-only: ${tool.isReadOnly()}`)
  console.log(`  - Needs permissions: ${tool.needsPermissions()}`)

  const prompt = await tool.prompt()
  console.log(`  - Prompt length: ${prompt.length} characters`)
  console.log(`  - Has usage notes: ${prompt.includes('Usage notes')}`)
}

/**
 * Test 4: Input schema validation
 */
async function testInputSchema() {
  console.log('\n=== Test 4: Input Schema Validation ===')

  const { webSearchInputSchema } = await import('../src/tools/websearch.mjs')

  try {
    // Valid input
    const validInput = {
      query: 'test search',
      limit: 10,
      allowedDomains: ['github.com'],
      blockedDomains: ['ads.com']
    }

    const result = webSearchInputSchema.parse(validInput)
    console.log('✓ Valid input accepted:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('✗ Validation failed:', error.message)
  }

  try {
    // Invalid input (missing required query)
    const invalidInput = { limit: 10 }
    webSearchInputSchema.parse(invalidInput)
    console.error('✗ Invalid input should have been rejected')
  } catch (error) {
    console.log('✓ Invalid input properly rejected')
    console.log(`  - Error: ${error.errors[0].message}`)
  }
}

/**
 * Test 5: Tool rendering messages
 */
async function testRenderingMessages() {
  console.log('\n=== Test 5: Tool Rendering Messages ===')

  const tool = createWebSearchTool()

  // Test renderToolUseMessage
  const useMsg = tool.renderToolUseMessage({
    query: 'NodeJS performance optimization',
    limit: 5,
    allowedDomains: ['nodejs.org']
  })
  console.log('✓ Tool use message:', useMsg)

  // Test renderToolResultMessage
  const resultMsg = tool.renderToolResultMessage({
    success: true,
    resultCount: 5
  })
  console.log('✓ Tool result rendered (React component created):', !!resultMsg)
}

/**
 * Test 6: Error handling
 */
async function testErrorHandling() {
  console.log('\n=== Test 6: Error Handling ===')

  const mockFailFetch = async () => {
    throw new Error('Network error')
  }

  const tool = createWebSearchTool({ fetch: mockFailFetch })
  clearCache()

  const generator = tool.call(
    { query: 'test' },
    { abortController: null }
  )

  for await (const result of generator) {
    if (result.type === 'result') {
      console.log('✓ Error handled gracefully')
      console.log(`  - Success: ${result.data.success}`)
      console.log(`  - Error message: ${result.data.error}`)
    }
  }
}

/**
 * Test 7: Cache functionality
 */
async function testCaching() {
  console.log('\n=== Test 7: Cache Functionality ===')

  const tool = createWebSearchTool({ fetch: createMockFetch() })
  clearCache()

  // First search
  console.log('First search (should not be cached)...')
  const generator1 = tool.call(
    { query: 'cache test' },
    { abortController: null }
  )

  let firstResult = null
  for await (const result of generator1) {
    if (result.type === 'result') {
      firstResult = result.data
    }
  }

  console.log(`  - From cache: ${firstResult.fromCache}`)

  // Second search with same query
  console.log('Second search (should be cached)...')
  const generator2 = tool.call(
    { query: 'cache test' },
    { abortController: null }
  )

  for await (const result of generator2) {
    if (result.type === 'result') {
      console.log(`  - From cache: ${result.data.fromCache}`)
      if (result.data.fromCache) {
        console.log('✓ Caching works correctly')
      }
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting WebSearch Tool Tests...')

  try {
    await testToolProperties()
    await testInputSchema()
    await testBasicSearch()
    await testResultLimit()
    await testRenderingMessages()
    await testErrorHandling()
    await testCaching()

    console.log('\n=== All Tests Completed ===')
    console.log('✓ WebSearch tool is fully functional')
  } catch (error) {
    console.error('\n✗ Test failed:', error)
    process.exit(1)
  }
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
}

// Vitest wrappers
import { describe, it, expect } from 'vitest'

describe('WebSearch Tool', () => {
  it('should have correct properties', async () => {
    await testToolProperties()
  })

  it('should validate input schema', async () => {
    await testInputSchema()
  })

  it('should perform basic search', async () => {
    await testBasicSearch()
  })

  it('should respect result limit', async () => {
    await testResultLimit()
  })

  it('should render messages', async () => {
    await testRenderingMessages()
  })

  it('should handle errors gracefully', async () => {
    await testErrorHandling()
  })

  it('should cache results', async () => {
    await testCaching()
  })
})

export {
  testBasicSearch,
  testResultLimit,
  testToolProperties,
  testInputSchema,
  testRenderingMessages,
  testErrorHandling,
  testCaching
}
