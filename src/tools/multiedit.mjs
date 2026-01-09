/**
 * MultiEdit Tool
 *
 * Perform multiple file edits in a single operation.
 * More efficient than sequential Edit calls for related changes.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, isAbsolute, dirname } from 'path'
import { mkdirSync } from 'fs'

// Tool metadata
export const MULTI_EDIT_SHORT_DESCRIPTION = "Perform multiple file edits in a single operation."

export const MULTI_EDIT_PROMPT = `Perform multiple file edits in a single operation. This is more efficient than sequential Edit calls when making related changes across multiple files.

Each edit specifies:
- file_path: The file to edit
- old_string: The text to replace
- new_string: The replacement text

All edits are validated before any are applied. If any edit would fail (e.g., old_string not found), none of the edits are applied.

Use this when:
- Making related changes across multiple files
- Renaming a symbol that appears in multiple places
- Applying a consistent pattern change across the codebase`

// Input schema
export const multiEditInputSchema = {
  type: 'object',
  properties: {
    edits: {
      type: 'array',
      description: 'Array of edit operations to perform',
      items: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to edit'
          },
          old_string: {
            type: 'string',
            description: 'The text to replace'
          },
          new_string: {
            type: 'string',
            description: 'The replacement text'
          }
        },
        required: ['file_path', 'old_string', 'new_string']
      }
    }
  },
  required: ['edits']
}

/**
 * Detect file encoding by checking BOM
 */
function detectEncoding(filePath) {
  const buffer = readFileSync(filePath)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8-bom'
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return 'utf-16le'
  }
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return 'utf-16be'
  }
  return 'utf-8'
}

/**
 * Detect line ending style
 */
function detectLineEnding(content) {
  if (content.includes('\r\n')) return '\r\n'
  if (content.includes('\r')) return '\r'
  return '\n'
}

/**
 * Create the MultiEdit tool
 */
export function createMultiEditTool(dependencies = {}) {
  const { getCwd = () => process.cwd(), isAllowed = () => true } = dependencies

  return {
    name: 'MultiEdit',

    description() {
      return MULTI_EDIT_SHORT_DESCRIPTION
    },

    prompt() {
      return MULTI_EDIT_PROMPT
    },

    inputSchema: multiEditInputSchema,

    userFacingName() {
      return 'Multi-File Edit'
    },

    isEnabled() {
      return true
    },

    isReadOnly() {
      return false
    },

    needsPermissions({ edits }) {
      // Check if any file requires permissions
      if (!edits) return false
      return edits.some(edit => !isAllowed(edit.file_path))
    },

    /**
     * Render result for assistant
     */
    renderResultForAssistant({ successCount, totalCount, results, error }) {
      if (error) return error

      if (successCount === totalCount) {
        return `Successfully applied ${successCount} edit(s).`
      }

      const failures = results.filter(r => !r.success)
      return `Applied ${successCount}/${totalCount} edits. Failures:\n${failures.map(f => `- ${f.file}: ${f.error}`).join('\n')}`
    },

    /**
     * Render tool use message
     */
    renderToolUseMessage(input, { verbose = false } = {}) {
      const count = input.edits?.length || 0
      const files = [...new Set(input.edits?.map(e => verbose ? e.file_path : e.file_path.split('/').pop()) || [])]
      return `Editing ${count} location(s) in ${files.length} file(s): ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`
    },

    /**
     * Validate input
     */
    validateInput({ edits }) {
      if (!edits || !Array.isArray(edits)) {
        return { result: false, message: 'edits must be an array.' }
      }

      if (edits.length === 0) {
        return { result: false, message: 'edits array cannot be empty.' }
      }

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i]

        if (!edit.file_path || typeof edit.file_path !== 'string') {
          return { result: false, message: `Edit ${i + 1}: file_path must be a non-empty string.` }
        }

        if (typeof edit.old_string !== 'string') {
          return { result: false, message: `Edit ${i + 1}: old_string must be a string.` }
        }

        if (typeof edit.new_string !== 'string') {
          return { result: false, message: `Edit ${i + 1}: new_string must be a string.` }
        }

        if (edit.old_string === edit.new_string) {
          return { result: false, message: `Edit ${i + 1}: old_string and new_string are identical.` }
        }
      }

      return { result: true }
    },

    /**
     * Execute multi-edit
     */
    async * call({ edits }) {
      const results = []
      const fileContents = new Map() // Cache file contents
      const fileEncodings = new Map()
      const fileLineEndings = new Map()

      // Phase 1: Validate all edits
      for (const edit of edits) {
        const fullPath = isAbsolute(edit.file_path) ? edit.file_path : resolve(getCwd(), edit.file_path)

        if (!existsSync(fullPath)) {
          results.push({
            file: edit.file_path,
            success: false,
            error: 'File does not exist'
          })
          continue
        }

        // Read and cache file content
        if (!fileContents.has(fullPath)) {
          const encoding = detectEncoding(fullPath)
          let content = readFileSync(fullPath, encoding === 'utf-8-bom' ? 'utf-8' : encoding)
          if (encoding === 'utf-8-bom' && content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1)
          }
          fileContents.set(fullPath, content)
          fileEncodings.set(fullPath, encoding)
          fileLineEndings.set(fullPath, detectLineEnding(content))
        }

        const content = fileContents.get(fullPath)

        if (!content.includes(edit.old_string)) {
          results.push({
            file: edit.file_path,
            success: false,
            error: 'old_string not found in file'
          })
          continue
        }

        // Count occurrences
        const occurrences = content.split(edit.old_string).length - 1
        if (occurrences > 1) {
          results.push({
            file: edit.file_path,
            success: false,
            error: `old_string found ${occurrences} times (must be unique)`
          })
          continue
        }

        results.push({
          file: edit.file_path,
          fullPath,
          oldString: edit.old_string,
          newString: edit.new_string,
          success: true,
          error: ''
        })
      }

      // Check if all validations passed
      const allValid = results.every(r => r.success)

      if (!allValid) {
        const result = {
          successCount: 0,
          totalCount: edits.length,
          results,
          error: 'Validation failed. No edits were applied.'
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
        return
      }

      // Phase 2: Apply all edits
      try {
        for (const editResult of results) {
          const content = fileContents.get(editResult.fullPath)
          const newContent = content.replace(editResult.oldString, editResult.newString)
          fileContents.set(editResult.fullPath, newContent)
        }

        // Write all files
        for (const [fullPath, content] of fileContents.entries()) {
          const encoding = fileEncodings.get(fullPath)
          let output = content
          const lineEnding = fileLineEndings.get(fullPath)

          // Normalize line endings
          if (lineEnding === '\r\n') {
            output = output.replace(/\n/g, '\r\n')
          } else if (lineEnding === '\r') {
            output = output.replace(/\n/g, '\r')
          }

          writeFileSync(fullPath, output, encoding === 'utf-8-bom' ? 'utf-8' : encoding)
        }

        const result = {
          successCount: results.length,
          totalCount: edits.length,
          results,
          error: ''
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      } catch (err) {
        const result = {
          successCount: 0,
          totalCount: edits.length,
          results,
          error: err instanceof Error ? err.message : 'Failed to apply edits'
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

export default createMultiEditTool
