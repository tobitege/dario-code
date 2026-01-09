/**
 * Markdown Parser - Regex Patterns Module
 *
 * Contains all regex patterns used for markdown parsing.
 * Separated for clarity and maintainability.
 *
 * @module markdown/patterns
 */

// =============================================================================
// NO-OP REGEX
// =============================================================================

/**
 * No-op regex that never matches
 * Used as placeholder for disabled rules
 */
export const NO_MATCH_REGEX = {
    /** @returns {null} Always returns null */
    ['ex' + 'ec']: () => null
};

// =============================================================================
// REGEX BUILDER
// =============================================================================

/**
 * Build a configurable regex with replacement capability
 * @param {string|RegExp} source - Base pattern
 * @param {string} [flags=''] - Regex flags
 * @returns {Object} Builder object with replace() and getRegex() methods
 */
export function buildRegex(source, flags = '') {
    let pattern = typeof source === 'string' ? source : source.source;

    const builder = {
        /**
         * Replace a named token in the pattern
         * @param {string|RegExp} name - Token to replace
         * @param {string|RegExp} replacement - Replacement pattern
         * @returns {Object} Builder for chaining
         */
        replace(name, replacement) {
            let replacementSource = typeof replacement === 'string'
                ? replacement
                : replacement.source;
            // Handle caret escaping for nested patterns
            replacementSource = replacementSource.replace(COMMON_PATTERNS.caret, '$1');
            pattern = pattern.replace(name, replacementSource);
            return builder;
        },

        /**
         * Compile and return the final regex
         * @returns {RegExp} Compiled regular expression
         */
        getRegex() {
            return new RegExp(pattern, flags);
        }
    };

    return builder;
}

// =============================================================================
// COMMON PATTERNS
// =============================================================================

/**
 * Common regex patterns used throughout the parser
 * Organized by category for maintainability
 */
export const COMMON_PATTERNS = {
    // Whitespace and line handling
    codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
    newLineCharGlobal: /\n/g,
    tabCharGlobal: /\t/g,
    multipleSpaceGlobal: /\s+/g,
    blankLine: /^[ \t]*$/,
    doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
    spaceLine: /^ +$/gm,
    carriageReturn: /\r\n|\r/g,
    beginningSpace: /^\s+/,
    startingSpaceChar: /^ /,
    endingSpaceChar: / $/,
    nonSpaceChar: /[^ ]/,
    notSpaceStart: /^\S*/,
    endingNewline: /\n$/,
    anyLine: /\n.*\n/,

    // Output processing
    outputLinkReplace: /\\([\[\]])/g,
    indentCodeCompensation: /^(\s+)(?:```)/,
    endingHash: /#$/,

    // Blockquote patterns
    blockquoteStart: /^ {0,3}>/,
    blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
    blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,

    // List patterns
    listReplaceTabs: /^\t+/,
    listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
    listIsTask: /^\[[ xX]\] /,
    listReplaceTask: /^\[[ xX]\] +/,

    // Table patterns
    tableDelimiter: /[:|]/,
    tableAlignChars: /^\||\| *$/g,
    tableRowBlankLine: /\n[ \t]*$/,
    tableAlignRight: /^ *-+: *$/,
    tableAlignCenter: /^ *:-+: *$/,
    tableAlignLeft: /^ *:-+ *$/,

    // HTML tag patterns
    startATag: /^<a /i,
    endATag: /^<\/a>/i,
    startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
    endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
    startAngleBracket: /^</,
    endAngleBracket: />$/,

    // Link and reference patterns
    hrefBrackets: /^<(.*)>$/,
    pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,

    // Unicode and character patterns
    unicodeAlphaNumeric: /[\p{L}\p{N}]/u,

    // Escape and encoding patterns
    escapeTest: /[&<>"']/,
    escapeReplace: /[&<>"']/g,
    escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
    escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
    unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
    caret: /(^|[^\[])\^/g,
    percentDecode: /%25/g,

    // Pipe handling (for tables)
    findPipe: /\|/g,
    splitPipe: / \|/,
    slashPipe: /\\\|/g,

    // Dynamic pattern generators
    listItemRegex: (bullet) => new RegExp(`^( {0,3}${bullet})((?:[	 ][^\\n]*)?(?:\\n|$))`),
    nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
    hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
    fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
    headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
    htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, 'i')
};

// =============================================================================
// BLOCK PATTERNS
// =============================================================================

/** Pattern for newlines/whitespace */
export const NEWLINE_PATTERN = /^(?:[ \t]*(?:\n|$))+/;

/** Pattern for indented code blocks */
export const CODE_PATTERN = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;

/** Pattern for fenced code blocks */
export const FENCES_PATTERN = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;

/** Pattern for horizontal rules */
export const HR_PATTERN = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;

/** Pattern for ATX headings */
export const HEADING_PATTERN = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;

/** Pattern for list bullets (ordered and unordered) */
export const BULLET_PATTERN = /(?:[*+-]|\d{1,9}[.)])/;

/** Label pattern for link references */
export const LABEL_PATTERN = /(?!\s*\])(?:\\.|[^\[\]\\])+/;

/** HTML comment pattern */
export const HTML_COMMENT_PATTERN = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;

/** HTML block tag names */
export const BLOCK_TAG_NAMES = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

/** Paragraph base pattern */
export const PARAGRAPH_BASE_PATTERN = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;

// =============================================================================
// INLINE PATTERNS
// =============================================================================

/** Escape pattern */
export const ESCAPE_PATTERN = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;

/** Inline code pattern */
export const CODE_SPAN_PATTERN = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;

/** Line break pattern */
export const BR_PATTERN = /^( {2,}|\\)\n(?!\s*$)/;

/** Inline text pattern */
export const TEXT_PATTERN = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;

/** Punctuation patterns */
export const PUNCTUATION_PATTERN = /[\p{P}\p{S}]/u;
export const PUNCTUATION_SPACE_PATTERN = /[\s\p{P}\p{S}]/u;
export const NON_PUNCT_SPACE_PATTERN = /[^\s\p{P}\p{S}]/u;

/** Block skip pattern (for inline processing) */
export const BLOCK_SKIP_PATTERN = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*`|<[^<>]*?>/g;

/** Link label pattern */
export const LINK_LABEL_PATTERN = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;

/** GFM punctuation patterns */
export const GFM_PUNCTUATION_PATTERN = /(?!~)[\p{P}\p{S}]/u;
export const GFM_PUNCT_SPACE_PATTERN = /(?!~)[\s\p{P}\p{S}]/u;
export const GFM_NON_PUNCT_SPACE_PATTERN = /(?:[^\s\p{P}\p{S}]|~)/u;
