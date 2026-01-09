/**
 * Write Tool - Write files to the filesystem
 *
 * This tool allows Claude to create new files or overwrite existing ones.
 * Requires reading existing files before overwriting them.
 */

import { z } from 'zod'

// Configuration constants
export const PREVIEW_LINES = 10
export const MAX_RESULT_LINES = 16000
export const CLIPPED_MESSAGE = '<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with Grep in order to find the line numbers of what you are looking for.</NOTE>'

// Input schema for the Write tool
export const writeInputSchema = z.strictObject({
  file_path: z.string().describe('The absolute path to the file to write (must be absolute, not relative)'),
  content: z.string().describe('The content to write to the file')
})

// Prompt/documentation for the Write tool
export const WRITE_PROMPT = `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the Read tool first to read the file's contents. This tool will fail if you did not read the file first.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.

Before using this tool:

1. Use the ReadFile tool to understand the file's contents and context

2. Directory Verification (only applicable when creating new files):
   - Use the LS tool to verify the parent directory exists and is the correct location`

/**
 * Create a unified diff patch
 */
export function createUnifiedPatch(filePath, oldContent, newContent) {
  const oldLines = (oldContent || '').split('\n')
  const newLines = newContent.split('\n')

  // Simple patch representation
  return {
    filePath,
    oldContent,
    newContent,
    hunks: [{
      oldStart: 1,
      oldLines: oldLines.length,
      newStart: 1,
      newLines: newLines.length
    }]
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
 * Create the Write tool definition
 */
export function createWriteTool(dependencies) {
  const {
    fs,
    path,
    os,
    getCurrentDir,
    resolvePath,
    fileExists,
    getFileStats,
    isInAllowedDirectory,
    detectEncoding,
    detectLineEnding,
    getDefaultLineEnding,
    writeFile,
    logError,
    logEvent,
    React
  } = dependencies

  return {
    name: 'Replace', // Internal name

    async description() {
      return 'Write a file to the local filesystem.'
    },

    userFacingName() {
      return 'Write'
    },

    async prompt() {
      return WRITE_PROMPT
    },

    inputSchema: writeInputSchema,

    async isEnabled() {
      return true
    },

    isReadOnly() {
      return false
    },

    needsPermissions({ file_path }) {
      return !isInAllowedDirectory?.(file_path)
    },

    renderToolUseMessage(input, { verbose } = {}) {
      const displayPath = verbose
        ? input.file_path
        : path.relative(getCurrentDir(), input.file_path)
      return `file_path: ${displayPath}`
    },

    renderToolUseRejectedMessage({ file_path, content }, { columns, verbose }) {
      if (!React) return null

      const resolvedPath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(getCurrentDir(), file_path)

      const exists = fileExists(resolvedPath)
      const action = exists ? 'update' : 'create'
      const displayPath = verbose ? file_path : path.relative(getCurrentDir(), file_path)

      return React.createElement('div', { style: { flexDirection: 'column' } },
        React.createElement('span', null,
          '  ⎿ ',
          React.createElement('span', { style: { color: 'red' } },
            `User rejected ${action} to `),
          React.createElement('span', { style: { fontWeight: 'bold' } }, displayPath)
        )
      )
    },

    renderToolResultMessage({ filePath, content, structuredPatch, type }, { verbose }) {
      if (!React) return null

      const displayPath = verbose ? filePath : path.relative(getCurrentDir(), filePath)

      switch (type) {
        case 'create': {
          const displayContent = content || '(No content)'
          const lineCount = content.split(os?.EOL || '\n').length

          return React.createElement('div', { style: { flexDirection: 'column' } },
            React.createElement('span', null,
              `  ⎿ Wrote ${lineCount} lines to `,
              React.createElement('span', { style: { fontWeight: 'bold' } }, displayPath)
            ),
            React.createElement('pre', { style: { paddingLeft: 20 } },
              verbose
                ? displayContent
                : displayContent.split('\n').slice(0, PREVIEW_LINES).filter(l => l.trim()).join('\n')
            ),
            !verbose && lineCount > PREVIEW_LINES &&
              React.createElement('span', { style: { color: 'gray' } },
                `... (+${lineCount - PREVIEW_LINES} lines)`)
          )
        }
        case 'update':
          return React.createElement('div', null,
            React.createElement('span', null, `  ⎿ Updated ${displayPath}`)
          )
      }
    },

    async validateInput({ file_path }, { readFileTimestamps }) {
      const resolvedPath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(getCurrentDir(), file_path)

      // New files don't need to be read first
      if (!fileExists(resolvedPath)) {
        return { result: true }
      }

      // Existing files must be read first
      const lastReadTime = readFileTimestamps[resolvedPath]
      if (!lastReadTime) {
        return {
          result: false,
          message: 'File has not been read yet. Read it first before writing to it.'
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

      return { result: true }
    },

    async *call({ file_path, content }, { readFileTimestamps }) {
      const resolvedPath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(getCurrentDir(), file_path)

      const parentDir = path.dirname(resolvedPath)
      const exists = fileExists(resolvedPath)

      // Get encoding and line ending
      const encoding = exists ? detectEncoding(resolvedPath) : 'utf-8'
      const originalContent = exists ? fs.readFileSync(resolvedPath, encoding) : null
      const lineEnding = exists
        ? detectLineEnding(resolvedPath)
        : await getDefaultLineEnding(getCurrentDir())

      // Create parent directory if needed
      if (!fileExists(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true })
      }

      // Write the file
      writeFile(resolvedPath, content, encoding, lineEnding)

      // Update timestamp
      readFileTimestamps[resolvedPath] = getFileStats(resolvedPath).mtimeMs

      // Track CLAUDE.md writes
      if (resolvedPath.endsWith(`${path.sep}CLAUDE.md`)) {
        logEvent?.('tengu_write_claudemd', {})
      }

      // Return result based on whether it was create or update
      if (originalContent !== null) {
        const patch = createUnifiedPatch(file_path, originalContent, content)
        const result = {
          type: 'update',
          filePath: file_path,
          content,
          structuredPatch: patch
        }

        yield {
          type: 'result',
          data: result,
          resultForAssistant: this.renderResultForAssistant(result)
        }
        return
      }

      const result = {
        type: 'create',
        filePath: file_path,
        content,
        structuredPatch: []
      }

      yield {
        type: 'result',
        data: result,
        resultForAssistant: this.renderResultForAssistant(result)
      }
    },

    renderResultForAssistant({ filePath, content, type }) {
      switch (type) {
        case 'create':
          return `File created successfully at: ${filePath}`
        case 'update': {
          const lines = content.split(/\r?\n/)
          const displayContent = lines.length > MAX_RESULT_LINES
            ? lines.slice(0, MAX_RESULT_LINES).join('\n') + CLIPPED_MESSAGE
            : content
          return `The file ${filePath} has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:
${formatWithLineNumbers(displayContent, 1)}`
        }
      }
    }
  }
}

export default createWriteTool
