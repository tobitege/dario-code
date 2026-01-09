/**
 * LSP (Language Server Protocol) Tool
 *
 * Interact with Language Server Protocol servers for code intelligence features.
 * Provides go-to-definition, find-references, hover, and other IDE-like features.
 */

// Tool metadata
export const LSP_SHORT_DESCRIPTION = "Interact with Language Server Protocol servers for code intelligence."

export const LSP_PROMPT = `Interact with Language Server Protocol (LSP) servers to get code intelligence features.

Supported operations:
- goToDefinition: Find where a symbol is defined
- findReferences: Find all references to a symbol
- hover: Get hover information (documentation, type info) for a symbol
- documentSymbol: Get all symbols (functions, classes, variables) in a document
- workspaceSymbol: Search for symbols across the entire workspace
- goToImplementation: Find implementations of an interface or abstract method
- prepareCallHierarchy: Get call hierarchy item at a position (functions/methods)
- incomingCalls: Find all functions/methods that call the function at a position
- outgoingCalls: Find all functions/methods called by the function at a position

All operations require:
- filePath: The file to operate on
- line: The line number (1-based, as shown in editors)
- character: The character offset (1-based, as shown in editors)

Note: LSP servers must be configured for the file type. If no server is available, an error will be returned.`

// Supported LSP operations
export const LSP_OPERATIONS = [
  'goToDefinition',
  'findReferences',
  'hover',
  'documentSymbol',
  'workspaceSymbol',
  'goToImplementation',
  'prepareCallHierarchy',
  'incomingCalls',
  'outgoingCalls'
]

// Input schema
export const lspInputSchema = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: LSP_OPERATIONS,
      description: 'The LSP operation to perform'
    },
    filePath: {
      type: 'string',
      description: 'The absolute or relative path to the file'
    },
    line: {
      type: 'integer',
      description: 'The line number (1-based, as shown in editors)',
      minimum: 1
    },
    character: {
      type: 'integer',
      description: 'The character offset (1-based, as shown in editors)',
      minimum: 1
    }
  },
  required: ['operation', 'filePath', 'line', 'character']
}

/**
 * Convert 1-based editor positions to 0-based LSP positions
 */
function toLspPosition(line, character) {
  return {
    line: line - 1,
    character: character - 1
  }
}

/**
 * Convert LSP 0-based positions to 1-based editor positions
 */
function toEditorPosition(position) {
  return {
    line: position.line + 1,
    character: position.character + 1
  }
}

/**
 * Format a location result
 */
function formatLocation(location) {
  const pos = toEditorPosition(location.range.start)
  return `${location.uri}:${pos.line}:${pos.character}`
}

/**
 * Create the LSP tool
 */
export function createLspTool(dependencies = {}) {
  const { lspClient } = dependencies

  return {
    name: 'LSP',

    description() {
      return LSP_SHORT_DESCRIPTION
    },

    prompt() {
      return LSP_PROMPT
    },

    inputSchema: lspInputSchema,

    userFacingName() {
      return 'Code Intelligence'
    },

    isEnabled() {
      return true
    },

    isReadOnly() {
      return true
    },

    needsPermissions() {
      return false
    },

    /**
     * Render result for assistant
     */
    renderResultForAssistant({ operation, results, error }) {
      if (error) return error

      if (!results || results.length === 0) {
        return `No results found for ${operation}.`
      }

      switch (operation) {
        case 'goToDefinition':
        case 'findReferences':
        case 'goToImplementation':
          return results.map(r => formatLocation(r)).join('\n')

        case 'hover':
          return results.contents || 'No hover information available.'

        case 'documentSymbol':
        case 'workspaceSymbol':
          return results.map(s => `${s.kind}: ${s.name} at line ${s.location?.range?.start?.line + 1 || 'unknown'}`).join('\n')

        case 'prepareCallHierarchy':
          return results.map(item => `${item.kind}: ${item.name}`).join('\n')

        case 'incomingCalls':
        case 'outgoingCalls':
          return results.map(call => `${call.from?.name || call.to?.name}`).join('\n')

        default:
          return JSON.stringify(results, null, 2)
      }
    },

    /**
     * Render tool use message
     */
    renderToolUseMessage(input, { verbose = false } = {}) {
      const path = verbose ? input.filePath : input.filePath.split('/').pop()
      return `${input.operation} at ${path}:${input.line}:${input.character}`
    },

    /**
     * Validate input
     */
    validateInput({ operation, filePath, line, character }) {
      if (!operation || !LSP_OPERATIONS.includes(operation)) {
        return { result: false, message: `Invalid operation. Must be one of: ${LSP_OPERATIONS.join(', ')}` }
      }

      if (!filePath || typeof filePath !== 'string') {
        return { result: false, message: 'filePath must be a non-empty string.' }
      }

      if (!Number.isInteger(line) || line < 1) {
        return { result: false, message: 'line must be a positive integer (1-based).' }
      }

      if (!Number.isInteger(character) || character < 1) {
        return { result: false, message: 'character must be a positive integer (1-based).' }
      }

      return { result: true }
    },

    /**
     * Execute LSP operation
     */
    async * call({ operation, filePath, line, character }) {
      // Convert to 0-based LSP positions
      const position = toLspPosition(line, character)

      try {
        // If no LSP client is available, return an error
        if (!lspClient) {
          const result = {
            operation,
            results: null,
            error: 'No LSP server configured for this file type. LSP operations require a running language server.'
          }

          yield {
            type: 'result',
            data: result,
            resultForAssistant: this.renderResultForAssistant(result)
          }
          return
        }

        // Execute the LSP operation
        let results
        const textDocument = { uri: `file://${filePath}` }

        switch (operation) {
          case 'goToDefinition':
            results = await lspClient.textDocumentDefinition({
              textDocument,
              position
            })
            break

          case 'findReferences':
            results = await lspClient.textDocumentReferences({
              textDocument,
              position,
              context: { includeDeclaration: true }
            })
            break

          case 'hover':
            results = await lspClient.textDocumentHover({
              textDocument,
              position
            })
            break

          case 'documentSymbol':
            results = await lspClient.textDocumentDocumentSymbol({
              textDocument
            })
            break

          case 'workspaceSymbol':
            results = await lspClient.workspaceSymbol({
              query: '' // Empty query returns all symbols
            })
            break

          case 'goToImplementation':
            results = await lspClient.textDocumentImplementation({
              textDocument,
              position
            })
            break

          case 'prepareCallHierarchy':
            results = await lspClient.textDocumentPrepareCallHierarchy({
              textDocument,
              position
            })
            break

          case 'incomingCalls':
            const preparedIncoming = await lspClient.textDocumentPrepareCallHierarchy({
              textDocument,
              position
            })
            if (preparedIncoming && preparedIncoming.length > 0) {
              results = await lspClient.callHierarchyIncomingCalls({
                item: preparedIncoming[0]
              })
            }
            break

          case 'outgoingCalls':
            const preparedOutgoing = await lspClient.textDocumentPrepareCallHierarchy({
              textDocument,
              position
            })
            if (preparedOutgoing && preparedOutgoing.length > 0) {
              results = await lspClient.callHierarchyOutgoingCalls({
                item: preparedOutgoing[0]
              })
            }
            break
        }

        const result = {
          operation,
          results: results || [],
          error: ''
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      } catch (err) {
        const result = {
          operation,
          results: null,
          error: err instanceof Error ? err.message : 'LSP operation failed'
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      }
    }
  }
}

export default createLspTool
