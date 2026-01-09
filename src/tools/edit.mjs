/**
 * Edit Tool - Make targeted edits to files
 *
 * This tool allows Claude to make precise string replacements in files.
 * It requires reading the file first to track modifications.
 */

import { z } from 'zod'
import { generateDiff, formatDiffForTerminal } from '../utils/diff.mjs'

// Context lines to show around edits
export const CONTEXT_LINES = 4

// Input schema for the Edit tool
export const editInputSchema = z.strictObject({
  file_path: z.string().describe('The absolute path to the file to modify'),
  old_string: z.string().describe('The text to replace'),
  new_string: z.string().describe('The text to replace it with (must be different from old_string)'),
  replace_all: z.boolean().default(false).describe('Replace all occurences of old_string (default false)')
})

// Prompt/documentation for the Edit tool
export const EDIT_PROMPT = `Performs exact string replacements in files.

Usage:
- You must use your \`Read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`

/**
 * Create a structured patch for the edit
 */
export function createPatch(filePath, oldContent, newContent) {
  // Simple diff representation
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  return {
    filePath,
    oldLines,
    newLines,
    hunks: [] // Would contain actual diff hunks in full implementation
  }
}

/**
 * Get a snippet around the edit location
 */
export function getEditSnippet(originalContent, oldString, newString) {
  const lines = originalContent.split('\n')
  const editStart = (originalContent.split(oldString)[0] || '').split(/\r?\n/).length - 1
  const newContent = originalContent.replace(oldString, newString)
  const newLines = newContent.split(/\r?\n/)

  const startLine = Math.max(0, editStart - CONTEXT_LINES)
  const endLine = editStart + CONTEXT_LINES + newString.split(/\r?\n/).length

  return {
    snippet: newLines.slice(startLine, endLine + 1).join('\n'),
    startLine: startLine + 1
  }
}

/**
 * Format content with line numbers (cat -n style)
 */
export function formatWithLineNumbers(content, startLine = 1) {
  const lines = content.split('\n')
  const maxLineNum = startLine + lines.length - 1
  const lineNumWidth = String(maxLineNum).length

  return lines.map((line, index) => {
    const lineNum = startLine + index
    const paddedLineNum = String(lineNum).padStart(lineNumWidth, ' ')
    return `${paddedLineNum}\t${line}`
  }).join('\n')
}

/**
 * Create the Edit tool definition
 */
export function createEditTool(dependencies) {
  const {
    fs,
    path,
    getCurrentDir,
    resolvePath,
    fileExists,
    getFileStats,
    findSimilarFile,
    isInAllowedDirectory,
    detectEncoding,
    detectLineEnding,
    normalizeLineEndings,
    writeFile,
    logError,
    logEvent,
    React
  } = dependencies

  return {
    name: 'Edit',

    async description() {
      return 'A tool for editing files'
    },

    async prompt() {
      return EDIT_PROMPT
    },

    inputSchema: editInputSchema,

    userFacingName(input) {
      const old_string = input?.old_string
      const new_string = input?.new_string
      if (old_string === '') return 'Create'
      if (new_string === '') return 'Delete'
      return 'Update'
    },

    async isEnabled() {
      return true
    },

    needsPermissions({ file_path }) {
      return !isInAllowedDirectory?.(file_path)
    },

    isReadOnly() {
      return false
    },

    renderToolUseMessage(input, { verbose } = {}) {
      const displayPath = verbose
        ? input.file_path
        : path.relative(getCurrentDir(), input.file_path)
      return `file_path: ${displayPath}`
    },

    renderToolResultMessage({ filePath, structuredPatch, oldString, newString }, { verbose }) {
      if (!React) return null

      const children = [
        React.createElement('span', { key: 'icon' }, '  ⎿  '),
        React.createElement('span', { key: 'msg' }, `Updated ${filePath}`),
      ]

      // Show inline diff if we have old/new strings
      if (oldString !== undefined && newString !== undefined && oldString !== newString) {
        try {
          const diffLines = generateDiff(oldString, newString, filePath)
          if (diffLines.length > 0) {
            const diffText = formatDiffForTerminal(diffLines)
            children.push(React.createElement('div', { key: 'diff', style: { marginLeft: 16 } },
              React.createElement('span', null, diffText)
            ))
          }
        } catch {
          // Diff rendering failed, skip
        }
      }

      return React.createElement('div', null, ...children)
    },

    renderToolUseRejectedMessage({ file_path, old_string, new_string }, { columns, verbose }) {
      if (!React) return null
      const displayPath = verbose ? file_path : path.relative(getCurrentDir(), file_path)
      const action = old_string === '' ? 'write' : 'update'
      return React.createElement('div', null,
        React.createElement('span', null, '  ⎿  '),
        React.createElement('span', { style: { color: 'red' } },
          `User rejected ${action} to `),
        React.createElement('span', { style: { fontWeight: 'bold' } }, displayPath)
      )
    },

    async validateInput({ file_path, old_string, new_string, replace_all = false }, { readFileTimestamps }) {
      // Check if strings are the same
      if (old_string === new_string) {
        return {
          result: false,
          message: 'No changes to make: old_string and new_string are exactly the same.',
          meta: { old_string }
        }
      }

      const resolvedPath = resolvePath(file_path)

      // Creating a new file
      if (old_string === '') {
        if (fileExists(resolvedPath)) {
          return {
            result: false,
            message: 'Cannot create new file - file already exists.'
          }
        }
        return { result: true }
      }

      // File must exist for editing
      if (!fileExists(resolvedPath)) {
        const similar = findSimilarFile?.(resolvedPath)
        let message = 'File does not exist.'
        if (similar) message += ` Did you mean ${similar}?`
        return { result: false, message }
      }

      // Check for Jupyter notebooks
      if (resolvedPath.endsWith('.ipynb')) {
        return {
          result: false,
          message: 'File is a Jupyter Notebook. Use the NotebookEdit tool to edit this file.'
        }
      }

      // File must have been read first
      const lastReadTime = readFileTimestamps[resolvedPath]
      if (!lastReadTime) {
        return {
          result: false,
          message: 'File has not been read yet. Read it first before writing to it.',
          meta: { isFilePathAbsolute: String(path.isAbsolute(file_path)) }
        }
      }

      // Check if file was modified since last read
      const stats = getFileStats(resolvedPath)
      if (stats.mtimeMs > lastReadTime) {
        return {
          result: false,
          message: 'File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.'
        }
      }

      // Read current content
      const encoding = detectEncoding(resolvedPath)
      const content = normalizeLineEndings(fs.readFileSync(resolvedPath, encoding))

      // Check if old_string exists in file
      if (!content.includes(old_string)) {
        return {
          result: false,
          message: 'String to replace not found in file.',
          meta: { isFilePathAbsolute: String(path.isAbsolute(file_path)) }
        }
      }

      // Check for multiple matches (skip when replace_all is true)
      const matchCount = content.split(old_string).length - 1
      if (!replace_all && matchCount > 1) {
        return {
          result: false,
          message: `Found ${matchCount} matches of the string to replace. For safety, this tool only supports replacing exactly one occurrence at a time. Add more lines of context to your edit and try again, or use replace_all to change every occurrence.`,
          meta: { isFilePathAbsolute: String(path.isAbsolute(file_path)) }
        }
      }

      return { result: true }
    },

    async *call({ file_path, old_string, new_string, replace_all = false }, { readFileTimestamps }) {
      const resolvedPath = resolvePath(file_path)

      // Ensure parent directory exists
      const parentDir = path.dirname(resolvedPath)
      if (!fileExists(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }

      // Get current file state or defaults for new files
      const encoding = fileExists(resolvedPath) ? detectEncoding(resolvedPath) : 'utf8'
      const lineEnding = fileExists(resolvedPath) ? detectLineEnding(resolvedPath) : 'LF'
      const originalContent = fileExists(resolvedPath)
        ? normalizeLineEndings(fs.readFileSync(resolvedPath, encoding))
        : ''

      // Perform the replacement
      const newContent = replace_all
        ? originalContent.replaceAll(old_string, new_string)
        : originalContent.replace(old_string, new_string)

      // Write the file
      writeFile(resolvedPath, newContent, encoding, lineEnding)

      // Update timestamp
      readFileTimestamps[resolvedPath] = getFileStats(resolvedPath).mtimeMs

      // Track CLAUDE.md writes
      if (resolvedPath.endsWith(`${path.sep}CLAUDE.md`)) {
        logEvent?.('tengu_write_claudemd', {})
      }

      // Create patch for display
      const patch = createPatch(resolvedPath, originalContent, newContent)

      const result = {
        filePath: file_path,
        oldString: old_string,
        newString: new_string,
        originalFile: originalContent,
        structuredPatch: patch
      }

      yield {
        type: 'result',
        data: result,
        resultForAssistant: this.renderResultForAssistant(result)
      }
    },

    renderResultForAssistant({ filePath, originalFile, oldString, newString }) {
      const { snippet, startLine } = getEditSnippet(originalFile || '', oldString, newString)
      return `The file ${filePath} has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:
${formatWithLineNumbers(snippet, startLine)}`
    }
  }
}

export default createEditTool
