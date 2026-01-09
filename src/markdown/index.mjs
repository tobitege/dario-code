/**
 * Markdown Parser Module
 *
 * A complete markdown parsing and rendering system with:
 * - Block-level tokenization (headings, lists, code blocks, etc.)
 * - Inline tokenization (emphasis, links, code spans, etc.)
 * - HTML rendering from tokens
 * - GFM (GitHub Flavored Markdown) support
 * - Pedantic mode for strict CommonMark compliance
 *
 * Architecture:
 * - MarkdownTokenizer (yu): Creates tokens from block/inline patterns
 * - MarkdownLexer (rZ): Orchestrates tokenization and manages state
 * - MarkdownRenderer (Pu): Converts tokens to HTML output
 * - TextRenderer (Po): Strips formatting, returns plain text
 * - MarkdownParser (aZ): Parses token arrays using renderers
 *
 * - yu -> MarkdownTokenizer
 * - rZ -> MarkdownLexer
 * - Pu -> MarkdownRenderer
 * - Po -> TextRenderer
 * - aZ -> MarkdownParser
 *
 * @module markdown
 */

// Import all components
import { COMMON_PATTERNS, buildRegex, NO_MATCH_REGEX } from './patterns.mjs';
import { BLOCK_RULES, INLINE_RULES } from './rules.mjs';
import { escapeHtml, sanitizeUrl, rtrim, splitTableCells } from './utils.mjs';
import { MarkdownTokenizer, yu } from './tokenizer.mjs';
import { MarkdownLexer, rZ } from './lexer.mjs';
import { MarkdownRenderer, TextRenderer, Pu, Po } from './renderer.mjs';
import { MarkdownParser, aZ } from './parser.mjs';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Default markdown parser options
 * @returns {Object} Default configuration object
 */
function getDefaultOptions() {
    return {
        async: false,           // Enable async rendering
        breaks: false,          // Convert \n to <br> in paragraphs
        extensions: null,       // Custom tokenizer/renderer extensions
        gfm: true,              // Enable GitHub Flavored Markdown
        hooks: null,            // Pre/post processing hooks
        pedantic: false,        // Strict CommonMark compliance
        renderer: null,         // Custom renderer instance
        silent: false,          // Suppress errors, log to console instead
        tokenizer: null,        // Custom tokenizer instance
        walkTokens: null        // Token tree walker callback
    };
}

/** @type {Object} Global default options */
let globalDefaults = getDefaultOptions();

/**
 * Update global default options
 * @param {Object} options - Options to merge with defaults
 */
function setGlobalOptions(options) {
    globalDefaults = options;
}

// =============================================================================
// HIGH-LEVEL API
// =============================================================================

/**
 * Parse markdown to HTML
 * @param {string} src - Markdown source
 * @param {Object} [options] - Parser options
 * @returns {string} HTML output
 */
function marked(src, options) {
    const opts = { ...globalDefaults, ...options };
    const lexer = new MarkdownLexer(opts);
    const tokens = lexer.lex(src);

    opts.renderer = opts.renderer || new MarkdownRenderer(opts);
    const parser = new MarkdownParser(opts);

    return parser.parse(tokens);
}

/**
 * Tokenize markdown without parsing
 * @param {string} src - Markdown source
 * @param {Object} [options] - Parser options
 * @returns {Array} Token array
 */
function lexer(src, options) {
    return MarkdownLexer.lex(src, options);
}

/**
 * Parse tokens to HTML
 * @param {Array} tokens - Token array
 * @param {Object} [options] - Parser options
 * @returns {string} HTML output
 */
function parser(tokens, options) {
    return MarkdownParser.parse(tokens, options);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
    // Main API
    marked,
    lexer,
    parser,

    yu,         // MarkdownTokenizer
    rZ,         // MarkdownLexer
    Pu,         // MarkdownRenderer
    Po,         // TextRenderer
    aZ,         // MarkdownParser

    // Classes (readable names)
    MarkdownTokenizer,
    MarkdownLexer,
    MarkdownRenderer,
    TextRenderer,
    MarkdownParser,

    // Configuration
    getDefaultOptions,
    setGlobalOptions,

    // Rules (for extensions)
    BLOCK_RULES,
    INLINE_RULES,
    COMMON_PATTERNS,
    NO_MATCH_REGEX,

    // Utilities
    escapeHtml,
    sanitizeUrl,
    rtrim,
    splitTableCells,
    buildRegex
};

export default marked;
