/**
 * Glob Tool - Fast file pattern matching
 *
 * This tool allows Claude to find files by glob patterns.
 * Results are sorted by modification time (most recent first).
 */

import { z } from 'zod'

// Configuration constants
export const DEFAULT_LIMIT = 100
export const DEFAULT_OFFSET = 0

// Input schema for the Glob tool
export const globInputSchema = z.strictObject({
  pattern: z.string().describe('The glob pattern to match files against'),
  path: z.string().optional().describe('The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.')
})

// Prompt/documentation for the Glob tool
export const GLOB_PROMPT = '- Fast file pattern matching tool that works with any codebase size\n' +
  '- Supports glob patterns like "**/*.js" or "src/**/*.ts"\n' +
  '- Returns matching file paths sorted by modification time\n' +
  '- Use this tool when you need to find files by name patterns\n' +
  '- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead\n' +
  '- You can call multiple tools in a single response. It is always better to speculatively perform multiple searches in parallel if they are potentially useful.'

/**
 * Create the Glob tool definition
 */
export function createGlobTool(dependencies) {
  const {
    path,
    getCurrentDir,
    resolvePath,
    isInAllowedDirectory,
    globFiles,
    logError,
    React
  } = dependencies

  return {
    name: 'GlobTool', // Internal name

    async description() {
      return GLOB_PROMPT
    },

    userFacingName() {
      return 'Glob'
    },

    inputSchema: globInputSchema,

    async isEnabled() {
      return true
    },

    isReadOnly() {
      return true
    },

    needsPermissions({ path: searchPath }) {
      return !isInAllowedDirectory?.(searchPath || getCurrentDir())
    },

    async prompt() {
      return GLOB_PROMPT
    },

    renderToolUseMessage({ pattern, path: searchPath } = {}, { verbose } = {}) {
      const cwd = getCurrentDir()
      const absolutePath = searchPath
        ? (path.isAbsolute(searchPath) ? searchPath : path.resolve(cwd, searchPath))
        : undefined
      const relativePath = absolutePath ? path.relative(cwd, absolutePath) : undefined

      return `pattern: "${pattern}"${relativePath || verbose ? `, path: "${verbose ? absolutePath : relativePath}"` : ''}`
    },

    renderToolUseRejectedMessage() {
      if (!React) return null
      return React.createElement('span', { style: { color: 'red' } }, 'Glob search rejected')
    },

    renderToolResultMessage(result) {
      if (!React) return null

      // Parse result if it's a string
      const data = typeof result === 'string' ? JSON.parse(result) : result

      return React.createElement('div', {
        style: { justifyContent: 'space-between', width: '100%' }
      },
        React.createElement('div', { style: { flexDirection: 'row' } },
          React.createElement('span', null, '  ⎿  Found '),
          React.createElement('span', { style: { fontWeight: 'bold' } }, data.numFiles, ' '),
          React.createElement('span', null, data.numFiles === 0 || data.numFiles > 1 ? 'files' : 'file')
        )
      )
    },

    async *call({ pattern, path: searchPath }, { abortController }) {
      const startTime = Date.now()
      const cwd = getCurrentDir()
      const targetDir = searchPath || cwd

      const { files, truncated } = await globFiles(pattern, targetDir, {
        limit: DEFAULT_LIMIT,
        offset: DEFAULT_OFFSET
      }, abortController.signal)

      const result = {
        filenames: files,
        durationMs: Date.now() - startTime,
        numFiles: files.length,
        truncated
      }

      yield {
        type: 'result',
        resultForAssistant: this.renderResultForAssistant(result),
        data: result
      }
    },

    renderResultForAssistant(result) {
      let output = result.filenames.join('\n')

      if (result.filenames.length === 0) {
        output = 'No files found'
      } else if (result.truncated) {
        output += '\n(Results are truncated. Consider using a more specific path or pattern.)'
      }

      return output
    }
  }
}

export default createGlobTool
