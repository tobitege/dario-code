/**
 * Markdown Parser - Utility Functions
 *
 * Helper functions for markdown parsing and rendering.
 *
 * @module markdown/utils
 */

import { COMMON_PATTERNS } from './patterns.mjs';

// =============================================================================
// HTML ESCAPING
// =============================================================================

/** HTML entity escape map */
const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * Get escape replacement character
 * @param {string} char - Character to escape
 * @returns {string} HTML entity
 */
const getEscapeChar = (char) => ESCAPE_MAP[char];

/**
 * Escape HTML special characters
 * @param {string} html - Input string
 * @param {boolean} [encode=false] - Whether to encode all entities
 * @returns {string} Escaped HTML
 */
export function escapeHtml(html, encode = false) {
    if (encode) {
        if (COMMON_PATTERNS.escapeTest.test(html)) {
            return html.replace(COMMON_PATTERNS.escapeReplace, getEscapeChar);
        }
    } else if (COMMON_PATTERNS.escapeTestNoEncode.test(html)) {
        return html.replace(COMMON_PATTERNS.escapeReplaceNoEncode, getEscapeChar);
    }
    return html;
}

/**
 * Sanitize a URL for use in href/src attributes
 * @param {string} href - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeUrl(href) {
    try {
        href = encodeURI(href).replace(COMMON_PATTERNS.percentDecode, '%');
    } catch {
        return null;
    }
    return href;
}

// =============================================================================
// STRING UTILITIES
// =============================================================================

/**
 * Remove trailing characters from a string
 * @param {string} str - Input string
 * @param {string} char - Character to remove
 * @returns {string} Trimmed string
 */
export function rtrim(str, char) {
    const len = str.length;
    if (len === 0) return '';

    let count = 0;
    while (count < len) {
        if (str.charAt(len - count - 1) === char) {
            count++;
        } else {
            break;
        }
    }

    return str.slice(0, len - count);
}

/**
 * Find the index of a closing bracket
 * @param {string} str - String to search
 * @param {string} brackets - Open and close bracket characters (e.g., '()')
 * @returns {number} Index of closing bracket, or -1 if not found
 */
export function findClosingBracket(str, brackets) {
    if (str.indexOf(brackets[1]) === -1) return -1;

    let depth = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\\') {
            i++;
        } else if (str[i] === brackets[0]) {
            depth++;
        } else if (str[i] === brackets[1]) {
            if (depth-- < 0) return i;
        }
    }

    return -1;
}

// =============================================================================
// TABLE UTILITIES
// =============================================================================

/**
 * Split a table row into cells, handling escaped pipes
 * @param {string} row - Table row text
 * @param {number} [count] - Expected cell count
 * @returns {string[]} Array of cell contents
 */
export function splitTableCells(row, count) {
    // Replace escaped pipes with markers
    let processed = row.replace(COMMON_PATTERNS.findPipe, (match, offset, str) => {
        let escaped = false;
        let pos = offset;
        while (--pos >= 0 && str[pos] === '\\') {
            escaped = !escaped;
        }
        return escaped ? '|' : ' |';
    });

    const cells = processed.split(COMMON_PATTERNS.splitPipe);

    // Trim leading empty cell
    if (!cells[0].trim()) cells.shift();

    // Trim trailing empty cell
    if (cells.length > 0 && !cells.at(-1)?.trim()) cells.pop();

    // Pad or trim to expected count
    if (count) {
        if (cells.length > count) {
            cells.splice(count);
        } else {
            while (cells.length < count) cells.push('');
        }
    }

    // Clean up each cell
    for (let i = 0; i < cells.length; i++) {
        cells[i] = cells[i].trim().replace(COMMON_PATTERNS.slashPipe, '|');
    }

    return cells;
}

// =============================================================================
// CODE BLOCK UTILITIES
// =============================================================================

/**
 * Compensate for indentation in code blocks
 * @param {string} raw - Raw block text
 * @param {string} text - Code content
 * @param {Object} rules - Parser rules
 * @returns {string} Adjusted code content
 */
export function compensateIndent(raw, text, rules) {
    const match = raw.match(rules.other.indentCodeCompensation);
    if (match === null) return text;

    const indent = match[1];
    return text.split('\n').map((line) => {
        const spaces = line.match(rules.other.beginningSpace);
        if (spaces === null) return line;

        const [leading] = spaces;
        if (leading.length >= indent.length) {
            return line.slice(indent.length);
        }
        return line;
    }).join('\n');
}

// =============================================================================
// LINK TOKEN CREATION
// =============================================================================

/**
 * Create a link or image token from a match
 * @param {Array} match - Regex match result
 * @param {Object} link - Link definition with href and title
 * @param {string} raw - Raw matched text
 * @param {Object} lexer - Lexer instance
 * @param {Object} rules - Parser rules
 * @returns {Object} Link or image token
 */
export function createLinkToken(match, link, raw, lexer, rules) {
    const href = link.href;
    const title = link.title || null;
    const text = match[1].replace(rules.other.outputLinkReplace, '$1');

    // Image token
    if (match[0].charAt(0) === '!') {
        return {
            type: 'image',
            raw,
            href,
            title,
            text
        };
    }

    // Link token
    lexer.state.inLink = true;
    const token = {
        type: 'link',
        raw,
        href,
        title,
        text,
        tokens: lexer.inlineTokens(text)
    };
    lexer.state.inLink = false;

    return token;
}
