/**
 * String and Markdown Parsing Utilities
 *
 * These utilities support markdown parsing, regex pattern building,
 * URL encoding, and text manipulation.
 */

/**
 * Common regex patterns used across string utilities
 * These are the basic patterns referenced by the regex builder
 */
const COMMON_PATTERNS = {
  // Pattern for replacing caret at start or after non-bracket char
  caret: /(^|[^\[])\^/g,
  // Find pipe characters for table parsing
  findPipe: /\|/g,
  // Split on space-pipe for table cells
  splitPipe: / \|/,
  // Match escaped pipes
  slashPipe: /\\\|/g,
  // Percent encoding fix
  percentDecode: /%25/g,
  // Code block indent detection
  indentCodeCompensation: /^(\s+)(?:```)/,
  // Beginning whitespace detection
  beginningSpace: /^\s+/,
  // Link bracket replacement
  outputLinkReplace: /\\([\[\]])/g
}

/**
 * Creates a chainable regex builder for constructing complex patterns
 * Allows replacing placeholders in a regex source string with other patterns
 *
 * @param {string|RegExp} pattern - Base pattern to modify
 * @param {string} [flags=''] - Regex flags to apply
 * @returns {Object} Builder with replace() and getRegex() methods
 *
 * @example
 * // Build complex regex by replacing placeholders
 * const linkRegex = createRegexBuilder(/^!\[(label)\]/)
 *   .replace('label', /[^\[\]]+/)
 *   .getRegex()
 */
export function createRegexBuilder(pattern, flags = '') {
  // Extract source from RegExp or use string directly
  let source = typeof pattern === 'string' ? pattern : pattern.source

  const builder = {
    /**
     * Replace a placeholder in the pattern with another pattern
     * @param {string|RegExp} target - Placeholder to replace
     * @param {string|RegExp} replacement - Pattern to insert
     * @returns {Object} Builder for chaining
     */
    replace(target, replacement) {
      // Get source from RegExp if needed
      const replacementSource = typeof replacement === 'string'
        ? replacement
        : replacement.source

      // Remove caret escaping from replacement (used for group references)
      const processedReplacement = replacementSource.replace(COMMON_PATTERNS.caret, '$1')

      // Perform the replacement in the source string
      source = source.replace(target, processedReplacement)

      return builder
    },

    /**
     * Compile the final regex with the given flags
     * @returns {RegExp} Compiled regular expression
     */
    getRegex() {
      return new RegExp(source, flags)
    }
  }

  return builder
}

/**
 * Encodes a URI string for use in links
 * Handles percent encoding edge cases
 *
 * @param {string} uri - URI string to encode
 * @returns {string|null} Encoded URI or null on error
 *
 * @example
 * encodeUri('https://example.com/path with spaces')
 * // Returns: 'https://example.com/path%20with%20spaces'
 */
export function encodeUri(uri) {
  try {
    // Encode the URI and fix double-encoded percent signs
    uri = encodeURI(uri).replace(COMMON_PATTERNS.percentDecode, '%')
  } catch {
    // Return null if URI is malformed
    return null
  }
  return uri
}

/**
 * Splits a markdown table row into individual cells
 * Handles escaped pipe characters and column alignment
 *
 * @param {string} row - Table row text to split
 * @param {number} [expectedCellCount] - Optional expected number of cells
 * @returns {string[]} Array of cell contents
 *
 * @example
 * splitTableCells('| Cell 1 | Cell 2 | Cell 3 |')
 * // Returns: ['Cell 1', 'Cell 2', 'Cell 3']
 *
 * splitTableCells('Value\\|With\\|Pipes | Normal')
 * // Returns: ['Value|With|Pipes', 'Normal']
 */
export function splitTableCells(row, expectedCellCount) {
  // First pass: normalize escaped pipes
  // If a pipe is preceded by an odd number of backslashes, it's escaped
  const normalized = row.replace(COMMON_PATTERNS.findPipe, (match, index, fullString) => {
    let isEscaped = false
    let checkIndex = index

    // Count preceding backslashes
    while (--checkIndex >= 0 && fullString[checkIndex] === '\\') {
      isEscaped = !isEscaped
    }

    // If escaped, return just the pipe (will be unescaped later)
    if (isEscaped) {
      return '|'
    }
    // Otherwise, add space before for clean splitting
    return ' |'
  })

  // Split on space-pipe delimiter
  const cells = normalized.split(COMMON_PATTERNS.splitPipe)

  // Remove empty first cell (leading pipe)
  if (!cells[0].trim()) {
    cells.shift()
  }

  // Remove empty last cell (trailing pipe)
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop()
  }

  // Adjust to expected cell count if specified
  if (expectedCellCount) {
    if (cells.length > expectedCellCount) {
      // Too many cells - truncate
      cells.splice(expectedCellCount)
    } else {
      // Too few cells - pad with empty strings
      while (cells.length < expectedCellCount) {
        cells.push('')
      }
    }
  }

  // Clean up each cell: trim whitespace and unescape pipes
  for (let i = 0; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(COMMON_PATTERNS.slashPipe, '|')
  }

  return cells
}

/**
 * Trims trailing occurrences of a specific character from a string
 * Unlike String.trimEnd() which removes whitespace, this removes a specific character
 *
 * @param {string} text - Input string to trim
 * @param {string} char - Character to remove from end
 * @param {*} [_unused] - Unused parameter (maintained for API compatibility)
 * @returns {string} String with trailing chars removed
 *
 * @example
 * trimTrailingChar('hello\n\n\n', '\n')
 * // Returns: 'hello'
 *
 * trimTrailingChar('path///', '/')
 * // Returns: 'path'
 */
export function trimTrailingChar(text, char, _unused) {
  const length = text.length

  // Empty string returns empty
  if (length === 0) {
    return ''
  }

  // Count trailing occurrences of the character
  let count = 0
  while (count < length) {
    if (text.charAt(length - count - 1) === char) {
      count++
    } else {
      break
    }
  }

  // Return string without trailing chars
  return text.slice(0, length - count)
}

/**
 * Creates a link or image token for markdown parsing
 * Processes matched regex groups into a structured token object
 *
 * @param {Array} match - Regex match array from link pattern
 * @param {Object} linkRef - Reference containing href and optional title
 * @param {string} linkRef.href - Link destination URL
 * @param {string} [linkRef.title] - Optional link title
 * @param {string} rawText - Original matched text
 * @param {Object} lexer - Lexer instance for recursive tokenization
 * @param {Object} rules - Parsing rules containing other.outputLinkReplace pattern
 * @returns {Object} Link or image token object
 *
 * @example
 * // For a link [text](url "title")
 * createLinkToken(
 *   ['[text](url)', 'text'],
 *   { href: 'https://example.com', title: 'My Link' },
 *   '[text](url "My Link")',
 *   lexerInstance,
 *   parserRules
 * )
 * // Returns: {
 * //   type: 'link',
 * //   raw: '[text](url "My Link")',
 * //   href: 'https://example.com',
 * //   title: 'My Link',
 * //   text: 'text',
 * //   tokens: [...]
 * // }
 */
export function createLinkToken(match, linkRef, rawText, lexer, rules) {
  const href = linkRef.href
  const title = linkRef.title || null

  // Extract link text, unescaping any escaped brackets
  const linkText = match[1].replace(rules.other.outputLinkReplace, '$1')

  // Check if this is an image (starts with !) or a link
  if (match[0].charAt(0) !== '!') {
    // It's a link - parse the text content recursively
    lexer.state.inLink = true

    const linkToken = {
      type: 'link',
      raw: rawText,
      href: href,
      title: title,
      text: linkText,
      tokens: lexer.inlineTokens(linkText)
    }

    lexer.state.inLink = false
    return linkToken
  }

  // It's an image - no recursive parsing needed
  return {
    type: 'image',
    raw: rawText,
    href: href,
    title: title,
    text: linkText
  }
}

/**
 * Extracts code block content with proper indent compensation
 * Removes the indentation that was used to denote the code block
 *
 * @param {string} rawBlock - Original code block with fences
 * @param {string} codeContent - Code content between fences
 * @param {Object} rules - Parsing rules containing indent patterns
 * @returns {string} Code content with normalized indentation
 *
 * @example
 * // For a code block like:
 * //     ```
 * //     ```
 */
export function extractCodeBlockContent(rawBlock, codeContent, rules) {
  // Check if the code block has leading indentation
  const indentMatch = rawBlock.match(rules.other.indentCodeCompensation)

  // If no indentation detected, return content as-is
  if (indentMatch === null) {
    return codeContent
  }

  // Get the indent string to remove
  const indent = indentMatch[1]

  // Process each line, removing the indentation if present
  return codeContent.split('\n').map((line) => {
    // Check for leading whitespace on this line
    const spaceMatch = line.match(rules.other.beginningSpace)

    // No leading space - return line unchanged
    if (spaceMatch === null) {
      return line
    }

    // Get the whitespace prefix
    const [lineIndent] = spaceMatch

    // If line has enough indentation, remove it
    if (lineIndent.length >= indent.length) {
      return line.slice(indent.length)
    }

    // Less indentation than expected - return unchanged
    return line
  }).join('\n')
}

/**
 * Adds indentation to each line of text
 * Useful for formatting code blocks or nested content
 *
 * @param {string} text - Text to indent
 * @param {string} [indent='  '] - Indent string to prepend to each line
 * @returns {string} Indented text
 *
 * @example
 * indentText('line 1\nline 2', '    ')
 * // Returns: '    line 1\n    line 2'
 */
export function indentText(text, indent = '  ') {
  if (!text) return text

  return text.split('\n').map(line => indent + line).join('\n')
}

// Export common patterns for external use
export { COMMON_PATTERNS }

// Default export with all utilities
export default {
  createRegexBuilder,
  encodeUri,
  splitTableCells,
  trimTrailingChar,
  createLinkToken,
  extractCodeBlockContent,
  indentText,
  COMMON_PATTERNS
}
