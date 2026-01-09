/**
 * Tab Completion Module for Mentions
 *
 * Provides tab completion for @-mention paths using readline interface.
 * Integrates with Node.js readline for seamless terminal experience.
 */

import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { getTabCompletions } from './index.mjs'
import { getCurrentDir } from '../core/utils.mjs'

/**
 * Create a completer function for readline
 * readline calls this with the current line and expects [completions, originalLine]
 */
export function createMentionCompleter() {
  return function completer(line) {
    // Find the last @mention in the line
    const lastAtIndex = line.lastIndexOf('@')

    if (lastAtIndex === -1) {
      // No @ found, no completions
      return [[], line]
    }

    // Extract the partial mention path
    const afterAt = line.slice(lastAtIndex + 1)

    // Only trigger completion if @ is followed by word characters
    // and not already complete (e.g., not followed by space yet)
    if (!/^[\w/.~*-]*$/.test(afterAt)) {
      return [[], line]
    }

    try {
      const basePath = getCurrentDir()
      const suggestions = getTabCompletions(`@${afterAt}`, basePath)

      if (suggestions.length === 0) {
        return [[], line]
      }

      // Format completions for readline
      const completions = suggestions.map(s => {
        // Calculate what to show for completion
        const prefix = afterAt.lastIndexOf('/') > -1
          ? afterAt.slice(0, afterAt.lastIndexOf('/') + 1)
          : ''

        return prefix + s.label + s.suffix
      })

      // Return completions and the common prefix
      return [completions, '@' + afterAt]
    } catch (error) {
      return [[], line]
    }
  }
}

/**
 * Enhanced completer that handles multiple completion contexts
 * Provides completions for both mentions and commands
 */
export function createEnhancedCompleter(additionalCompleters = []) {
  return function enhancedCompleter(line) {
    // Check for @-mention completion
    const lastAtIndex = line.lastIndexOf('@')
    const lastSpaceIndex = line.lastIndexOf(' ')

    // If @ appears after the last space, it's a mention completion
    if (lastAtIndex > lastSpaceIndex) {
      const afterAt = line.slice(lastAtIndex + 1)

      if (!/^[\w/.~*-]*$/.test(afterAt)) {
        return [[], line]
      }

      try {
        const basePath = getCurrentDir()
        const suggestions = getTabCompletions(`@${afterAt}`, basePath)

        if (suggestions.length === 0) {
          return [[], line]
        }

        const completions = suggestions.map(s => {
          const prefix = afterAt.lastIndexOf('/') > -1
            ? afterAt.slice(0, afterAt.lastIndexOf('/') + 1)
            : ''
          return prefix + s.label + s.suffix
        })

        return [completions, '@' + afterAt]
      } catch (error) {
        return [[], line]
      }
    }

    // Try other completers
    for (const completer of additionalCompleters) {
      const result = completer(line)
      if (result[0].length > 0) {
        return result
      }
    }

    return [[], line]
  }
}

/**
 * Create a custom readline interface with mention completion
 */
export function createReadlineWithMentionCompletion(input, output) {

  const rl = readline.createInterface({
    input,
    output,
    completer: createMentionCompleter(),
    historySize: 100,
    removeHistoryDuplicates: true
  })

  // Store the original question method
  const originalQuestion = rl.question.bind(rl)

  // Override question to provide our completer
  rl.question = function(query, callback) {
    this.completer = createMentionCompleter()
    return originalQuestion(query, callback)
  }

  return rl
}

/**
 * Format suggestions for display during tab completion
 */
export function formatSuggestions(suggestions, maxDisplay = 10) {
  if (suggestions.length === 0) {
    return ''
  }

  let output = '\nSuggestions:\n'

  const toShow = suggestions.slice(0, maxDisplay)
  for (const suggestion of toShow) {
    const type = suggestion.isDirectory ? '/' : '·'
    output += `  ${type} ${suggestion.label}${suggestion.suffix}\n`
  }

  if (suggestions.length > maxDisplay) {
    output += `  ... and ${suggestions.length - maxDisplay} more\n`
  }

  output += '\n'
  return output
}

/**
 * Create a preview of file being referenced in mention
 */
export function createMentionPreview(filePath, maxLines = 5) {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }

    const stats = fs.statSync(filePath)
    if (!stats.isFile()) {
      return null
    }

    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n').slice(0, maxLines)

    return {
      path: filePath,
      size: stats.size,
      lines: lines.length,
      preview: lines.join('\n')
    }
  } catch (error) {
    return null
  }
}

/**
 * Advanced completer with suggestions and previews
 */
export function createAdvancedCompleter(showPreviews = false) {
  return function advancedCompleter(line) {
    const lastAtIndex = line.lastIndexOf('@')

    if (lastAtIndex === -1) {
      return [[], line]
    }

    const afterAt = line.slice(lastAtIndex + 1)

    if (!/^[\w/.~*-]*$/.test(afterAt)) {
      return [[], line]
    }

    try {
      const basePath = getCurrentDir()
      const suggestions = getTabCompletions(`@${afterAt}`, basePath)

      if (suggestions.length === 0) {
        return [[], line]
      }

      const completions = suggestions.map(s => {
        const prefix = afterAt.lastIndexOf('/') > -1
          ? afterAt.slice(0, afterAt.lastIndexOf('/') + 1)
          : ''
        return prefix + s.label + s.suffix
      })

      // Optionally show previews for single file matches
      if (showPreviews && suggestions.length === 1 && !suggestions[0].isDirectory) {
        const preview = createMentionPreview(suggestions[0].path)
        if (preview) {
          process.stdout.write(`\n${preview.preview}...\n`)
        }
      }

      return [completions, '@' + afterAt]
    } catch (error) {
      return [[], line]
    }
  }
}

export default {
  createMentionCompleter,
  createEnhancedCompleter,
  createReadlineWithMentionCompletion,
  formatSuggestions,
  createMentionPreview,
  createAdvancedCompleter
}
