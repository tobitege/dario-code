/**
 * Code Stats plugin — line counter tool
 */

import fs from 'fs'
import path from 'path'

export function activate(context) {
  context.registerTool({
    name: 'line_counter',
    description: 'Count lines of code in a file or directory',
    parameters: {
      path: { type: 'string', description: 'File or directory path to count' },
    },
    async execute({ path: targetPath }) {
      const config = context.getConfig()
      const extensions = config?.extensions || ['.js', '.mjs', '.ts', '.tsx']
      const ignorePatterns = config?.ignorePatterns || ['node_modules', '.git']

      const stats = { files: 0, lines: 0, blank: 0 }

      function countFile(filePath) {
        try {
          const content = fs.readFileSync(filePath, 'utf8')
          const lines = content.split('\n')
          stats.files++
          stats.lines += lines.length
          stats.blank += lines.filter(l => l.trim() === '').length
        } catch {
          // skip unreadable files
        }
      }

      function walk(dir) {
        let entries
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch {
          return
        }
        for (const entry of entries) {
          if (ignorePatterns.some(p => entry.name === p)) continue
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            walk(full)
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            countFile(full)
          }
        }
      }

      const resolved = path.resolve(targetPath)
      try {
        const stat = fs.statSync(resolved)
        if (stat.isDirectory()) {
          walk(resolved)
        } else {
          countFile(resolved)
        }
      } catch {
        return { error: `Path not found: ${targetPath}` }
      }

      return {
        path: targetPath,
        files: stats.files,
        totalLines: stats.lines,
        blankLines: stats.blank,
        codeLines: stats.lines - stats.blank,
      }
    },
  })
}

export function deactivate() {}
