/**
 * NotebookEdit Tool
 *
 * Edit Jupyter notebook (.ipynb) cells - replace, insert, or delete.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, isAbsolute, extname } from 'path'

// Tool metadata
export const NOTEBOOK_EDIT_SHORT_DESCRIPTION = "Replace the contents of a specific cell in a Jupyter notebook."

export const NOTEBOOK_EDIT_PROMPT = `Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source. Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing. The notebook_path parameter must be an absolute path, not a relative path. The cell_number is 0-indexed. Use edit_mode=insert to add a new cell at the index specified by cell_number. Use edit_mode=delete to delete the cell at the index specified by cell_number.`

// Input schema (Zod-style object for reference)
export const notebookEditInputSchema = {
  type: 'object',
  properties: {
    notebook_path: {
      type: 'string',
      description: 'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)'
    },
    cell_number: {
      type: 'number',
      description: 'The index of the cell to edit (0-based)'
    },
    new_source: {
      type: 'string',
      description: 'The new source for the cell'
    },
    cell_type: {
      type: 'string',
      enum: ['code', 'markdown'],
      description: 'The type of the cell (code or markdown). If not specified, defaults to current cell type. Required for edit_mode=insert.'
    },
    edit_mode: {
      type: 'string',
      enum: ['replace', 'insert', 'delete'],
      description: 'The type of edit to make. Defaults to replace.'
    }
  },
  required: ['notebook_path', 'new_source']
}

/**
 * Detect file encoding by checking BOM
 */
function detectEncoding(filePath) {
  const buffer = readFileSync(filePath)
  // Check for UTF-8 BOM
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8-bom'
  }
  // Check for UTF-16 LE BOM
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return 'utf-16le'
  }
  // Check for UTF-16 BE BOM
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return 'utf-16be'
  }
  return 'utf-8'
}

/**
 * Read file with detected encoding
 */
function readWithEncoding(filePath, encoding) {
  if (encoding === 'utf-8-bom') {
    const content = readFileSync(filePath, 'utf-8')
    // Remove BOM if present
    return content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content
  }
  return readFileSync(filePath, encoding === 'utf-16le' || encoding === 'utf-16be' ? encoding : 'utf-8')
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
 * Parse notebook JSON safely
 */
function parseNotebook(content) {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Create the NotebookEdit tool
 */
export function createNotebookEditTool(dependencies = {}) {
  const { getCwd = () => process.cwd(), isAllowed = () => true } = dependencies

  return {
    name: 'NotebookEdit',

    description() {
      return NOTEBOOK_EDIT_SHORT_DESCRIPTION
    },

    prompt() {
      return NOTEBOOK_EDIT_PROMPT
    },

    inputSchema: notebookEditInputSchema,

    userFacingName() {
      return 'Edit Notebook'
    },

    isEnabled() {
      return true
    },

    isReadOnly() {
      return false
    },

    needsPermissions({ notebook_path }) {
      return !isAllowed(notebook_path)
    },

    /**
     * Render result message for assistant
     */
    renderResultForAssistant({ cell_number, edit_mode, new_source, error }) {
      if (error) return error

      switch (edit_mode) {
        case 'replace':
          return `Updated cell ${cell_number} with ${new_source}`
        case 'insert':
          return `Inserted cell ${cell_number} with ${new_source}`
        case 'delete':
          return `Deleted cell ${cell_number}`
        default:
          return `Modified cell ${cell_number}`
      }
    },

    /**
     * Render tool use message for display
     */
    renderToolUseMessage(input, { verbose = false } = {}) {
      const path = verbose ? input.notebook_path : input.notebook_path.split('/').pop()
      const source = input.new_source.length > 30
        ? input.new_source.slice(0, 30) + '…'
        : input.new_source
      return `notebook_path: ${path}, cell: ${input.cell_number}, content: ${source}, cell_type: ${input.cell_type}, edit_mode: ${input.edit_mode ?? 'replace'}`
    },

    /**
     * Validate input before execution
     */
    validateInput({ notebook_path, cell_number, cell_type, edit_mode = 'replace' }) {
      const fullPath = isAbsolute(notebook_path) ? notebook_path : resolve(getCwd(), notebook_path)

      if (!existsSync(fullPath)) {
        return { result: false, message: 'Notebook file does not exist.' }
      }

      if (extname(fullPath) !== '.ipynb') {
        return { result: false, message: 'File must be a Jupyter notebook (.ipynb file). For editing other file types, use the FileEdit tool.' }
      }

      if (cell_number < 0) {
        return { result: false, message: 'Cell number must be non-negative.' }
      }

      if (edit_mode !== 'replace' && edit_mode !== 'insert' && edit_mode !== 'delete') {
        return { result: false, message: 'Edit mode must be replace, insert, or delete.' }
      }

      if (edit_mode === 'insert' && !cell_type) {
        return { result: false, message: 'Cell type is required when using edit_mode=insert.' }
      }

      // Parse and validate notebook
      const encoding = detectEncoding(fullPath)
      const content = readWithEncoding(fullPath, encoding)
      const notebook = parseNotebook(content)

      if (!notebook) {
        return { result: false, message: 'Notebook is not valid JSON.' }
      }

      if (edit_mode === 'insert' && cell_number > notebook.cells.length) {
        return { result: false, message: `Cell number is out of bounds. For insert mode, the maximum value is ${notebook.cells.length} (to append at the end).` }
      }

      if ((edit_mode === 'replace' || edit_mode === 'delete') && (cell_number >= notebook.cells.length || !notebook.cells[cell_number])) {
        return { result: false, message: `Cell number is out of bounds. Notebook has ${notebook.cells.length} cells.` }
      }

      return { result: true }
    },

    /**
     * Execute the notebook edit
     */
    async * call({ notebook_path, cell_number, new_source, cell_type, edit_mode = 'replace' }) {
      const fullPath = isAbsolute(notebook_path) ? notebook_path : resolve(getCwd(), notebook_path)

      try {
        const encoding = detectEncoding(fullPath)
        const content = readWithEncoding(fullPath, encoding)
        const notebook = JSON.parse(content)
        const language = notebook.metadata?.language_info?.name ?? 'python'

        // Perform the edit
        if (edit_mode === 'delete') {
          notebook.cells.splice(cell_number, 1)
        } else if (edit_mode === 'insert') {
          const newCell = {
            cell_type,
            source: new_source,
            metadata: {}
          }

          // Code cells need outputs array
          if (cell_type !== 'markdown') {
            newCell.outputs = []
          }

          notebook.cells.splice(cell_number, 0, newCell)
        } else {
          // Replace mode
          const cell = notebook.cells[cell_number]
          cell.source = new_source
          cell.execution_count = undefined
          cell.outputs = []

          if (cell_type && cell_type !== cell.cell_type) {
            cell.cell_type = cell_type
          }
        }

        // Detect line ending and write back
        const lineEnding = detectLineEnding(content)
        let output = JSON.stringify(notebook, null, 1)

        // Normalize line endings
        if (lineEnding === '\r\n') {
          output = output.replace(/\n/g, '\r\n')
        } else if (lineEnding === '\r') {
          output = output.replace(/\n/g, '\r')
        }

        writeFileSync(fullPath, output, encoding === 'utf-8-bom' ? 'utf-8' : encoding)

        const result = {
          cell_number,
          new_source,
          cell_type: cell_type ?? 'code',
          language,
          edit_mode,
          error: ''
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
      } catch (err) {
        const errorResult = {
          cell_number,
          new_source,
          cell_type: cell_type ?? 'code',
          language: 'python',
          edit_mode: 'replace',
          error: err instanceof Error ? err.message : 'Unknown error occurred while editing notebook'
        }

        yield {
          type: 'result',
          data: errorResult,
          resultForAssistant: this.renderResultForAssistant(errorResult)
        }
      }
    }
  }
}

export default createNotebookEditTool
