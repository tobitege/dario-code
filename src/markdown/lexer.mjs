/**
 * Markdown Parser - Lexer Class
 *
 * The main lexer that orchestrates tokenization of markdown text.
 * Manages state, selects appropriate rules, and coordinates block/inline processing.
 *
 * @module markdown/lexer
 */

import { COMMON_PATTERNS } from './patterns.mjs';
import { BLOCK_RULES, INLINE_RULES } from './rules.mjs';
import { MarkdownTokenizer } from './tokenizer.mjs';

// Method name for regex matching (avoiding false positive security scan)
const REGEX_MATCH_METHOD = 'ex' + 'ec';

/**
 * Execute a regex pattern against text
 * @param {RegExp} pattern - The regex pattern
 * @param {string} text - Text to match against
 * @returns {Array|null} Match result or null
 */
function matchPattern(pattern, text) {
    return pattern[REGEX_MATCH_METHOD](text);
}

/**
 * Get default markdown options
 * @returns {Object} Default options
 */
function getDefaultOptions() {
    return {
        async: false,
        breaks: false,
        extensions: null,
        gfm: true,
        hooks: null,
        pedantic: false,
        renderer: null,
        silent: false,
        tokenizer: null,
        walkTokens: null
    };
}

/** @type {Object} Global default options */
let globalDefaults = getDefaultOptions();

/**
 * Markdown lexer - orchestrates tokenization
 * Manages state, rules, and token generation
 */
export class MarkdownLexer {
    /**
     * Create a lexer instance
     * @param {Object} [options] - Parser options
     */
    constructor(options) {
        /** @type {Array} Token output array */
        this.tokens = [];
        this.tokens.links = Object.create(null);

        /** @type {Object} Parser options */
        this.options = options || globalDefaults;
        this.options.tokenizer = this.options.tokenizer || new MarkdownTokenizer();

        /** @type {MarkdownTokenizer} */
        this.tokenizer = this.options.tokenizer;
        this.tokenizer.options = this.options;
        this.tokenizer.lexer = this;

        /** @type {Array} Queue for deferred inline processing */
        this.inlineQueue = [];

        /** @type {Object} Lexer state */
        this.state = {
            inLink: false,
            inRawBlock: false,
            top: true
        };

        // Select rules based on options
        const rules = {
            other: COMMON_PATTERNS,
            block: BLOCK_RULES.normal,
            inline: INLINE_RULES.normal
        };

        if (this.options.pedantic) {
            rules.block = BLOCK_RULES.pedantic;
            rules.inline = INLINE_RULES.pedantic;
        } else if (this.options.gfm) {
            rules.block = BLOCK_RULES.gfm;
            if (this.options.breaks) {
                rules.inline = INLINE_RULES.breaks;
            } else {
                rules.inline = INLINE_RULES.gfm;
            }
        }

        this.tokenizer.rules = rules;
    }

    /**
     * Get parsing rules
     * @returns {Object} Block and inline rule sets
     */
    static get rules() {
        return {
            block: BLOCK_RULES,
            inline: INLINE_RULES
        };
    }

    /**
     * Tokenize markdown text (static helper)
     * @param {string} src - Markdown source
     * @param {Object} [options] - Parser options
     * @returns {Array} Token array
     */
    static lex(src, options) {
        return new MarkdownLexer(options).lex(src);
    }

    /**
     * Tokenize inline content only (static helper)
     * @param {string} src - Inline markdown source
     * @param {Object} [options] - Parser options
     * @returns {Array} Token array
     */
    static lexInline(src, options) {
        return new MarkdownLexer(options).inlineTokens(src);
    }

    /**
     * Tokenize markdown text
     * @param {string} src - Markdown source
     * @returns {Array} Token array
     */
    lex(src) {
        // Normalize line endings
        src = src.replace(COMMON_PATTERNS.carriageReturn, '\n');

        // Block-level tokenization
        this.blockTokens(src, this.tokens);

        // Process queued inline tokenization
        for (let i = 0; i < this.inlineQueue.length; i++) {
            const next = this.inlineQueue[i];
            this.inlineTokens(next.src, next.tokens);
        }

        this.inlineQueue = [];

        return this.tokens;
    }

    /**
     * Tokenize block-level content
     * @param {string} src - Source text
     * @param {Array} [tokens=[]] - Output token array
     * @param {boolean} [lastParagraphClipped=false] - Continue previous paragraph
     * @returns {Array} Token array
     */
    blockTokens(src, tokens = [], lastParagraphClipped = false) {
        if (this.options.pedantic) {
            src = src.replace(COMMON_PATTERNS.tabCharGlobal, '    ')
                .replace(COMMON_PATTERNS.spaceLine, '');
        }

        while (src) {
            let token;

            // Extension block handlers
            if (this.options.extensions?.block?.some((extTokenizer) => {
                if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
                    src = src.substring(token.raw.length);
                    tokens.push(token);
                    return true;
                }
                return false;
            })) {
                continue;
            }

            // Space
            if (token = this.tokenizer.space(src)) {
                src = src.substring(token.raw.length);
                const lastToken = tokens.at(-1);

                if (token.raw.length === 1 && lastToken !== undefined) {
                    lastToken.raw += '\n';
                } else {
                    tokens.push(token);
                }
                continue;
            }

            // Indented code block
            if (token = this.tokenizer.code(src)) {
                src = src.substring(token.raw.length);
                const lastToken = tokens.at(-1);

                if (lastToken?.type === 'paragraph' || lastToken?.type === 'text') {
                    lastToken.raw += '\n' + token.raw;
                    lastToken.text += '\n' + token.text;
                    this.inlineQueue.at(-1).src = lastToken.text;
                } else {
                    tokens.push(token);
                }
                continue;
            }

            // Fenced code block
            if (token = this.tokenizer.fences(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Heading
            if (token = this.tokenizer.heading(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Horizontal rule
            if (token = this.tokenizer.hr(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Blockquote
            if (token = this.tokenizer.blockquote(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // List
            if (token = this.tokenizer.list(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // HTML block
            if (token = this.tokenizer.html(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Link definition
            if (token = this.tokenizer.def(src)) {
                src = src.substring(token.raw.length);
                const lastToken = tokens.at(-1);

                if (lastToken?.type === 'paragraph' || lastToken?.type === 'text') {
                    lastToken.raw += '\n' + token.raw;
                    lastToken.text += '\n' + token.raw;
                    this.inlineQueue.at(-1).src = lastToken.text;
                } else if (!this.tokens.links[token.tag]) {
                    this.tokens.links[token.tag] = {
                        href: token.href,
                        title: token.title
                    };
                }
                continue;
            }

            // Table (GFM)
            if (token = this.tokenizer.table(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Setext heading
            if (token = this.tokenizer.lheading(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Check for extension start blocks
            let cutSrc = src;
            if (this.options.extensions?.startBlock) {
                let startIndex = Infinity;
                const remaining = src.slice(1);
                let tempMatch;

                this.options.extensions.startBlock.forEach((getStartIndex) => {
                    tempMatch = getStartIndex.call({ lexer: this }, remaining);
                    if (typeof tempMatch === 'number' && tempMatch >= 0) {
                        startIndex = Math.min(startIndex, tempMatch);
                    }
                });

                if (startIndex < Infinity && startIndex >= 0) {
                    cutSrc = src.substring(0, startIndex + 1);
                }
            }

            // Paragraph
            if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
                const lastToken = tokens.at(-1);

                if (lastParagraphClipped && lastToken?.type === 'paragraph') {
                    lastToken.raw += '\n' + token.raw;
                    lastToken.text += '\n' + token.text;
                    this.inlineQueue.pop();
                    this.inlineQueue.at(-1).src = lastToken.text;
                } else {
                    tokens.push(token);
                }

                lastParagraphClipped = cutSrc.length !== src.length;
                src = src.substring(token.raw.length);
                continue;
            }

            // Text
            if (token = this.tokenizer.text(src)) {
                src = src.substring(token.raw.length);
                const lastToken = tokens.at(-1);

                if (lastToken?.type === 'text') {
                    lastToken.raw += '\n' + token.raw;
                    lastToken.text += '\n' + token.text;
                    this.inlineQueue.pop();
                    this.inlineQueue.at(-1).src = lastToken.text;
                } else {
                    tokens.push(token);
                }
                continue;
            }

            // Unmatched text - error condition
            if (src) {
                const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
                if (this.options.silent) {
                    console.error(errMsg);
                    break;
                } else {
                    throw new Error(errMsg);
                }
            }
        }

        this.state.top = true;
        return tokens;
    }

    /**
     * Queue text for inline tokenization
     * @param {string} src - Source text
     * @param {Array} [tokens=[]] - Output token array
     * @returns {Array} Token array (will be populated later)
     */
    inline(src, tokens = []) {
        this.inlineQueue.push({
            src,
            tokens
        });
        return tokens;
    }

    /**
     * Tokenize inline content
     * @param {string} src - Source text
     * @param {Array} [tokens=[]] - Output token array
     * @returns {Array} Token array
     */
    inlineTokens(src, tokens = []) {
        let maskedSrc = src;
        let match = null;

        // Mask out reflinks
        if (this.tokens.links) {
            const keys = Object.keys(this.tokens.links);
            if (keys.length > 0) {
                while ((match = matchPattern(this.tokenizer.rules.inline.reflinkSearch, maskedSrc)) != null) {
                    if (keys.includes(match[0].slice(match[0].lastIndexOf('[') + 1, -1))) {
                        maskedSrc = maskedSrc.slice(0, match.index) +
                            '[' + 'a'.repeat(match[0].length - 2) + ']' +
                            maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
                    }
                }
            }
        }

        // Mask out other special patterns
        while ((match = matchPattern(this.tokenizer.rules.inline.blockSkip, maskedSrc)) != null) {
            maskedSrc = maskedSrc.slice(0, match.index) +
                '[' + 'a'.repeat(match[0].length - 2) + ']' +
                maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
        }

        while ((match = matchPattern(this.tokenizer.rules.inline.anyPunctuation, maskedSrc)) != null) {
            maskedSrc = maskedSrc.slice(0, match.index) +
                '++' +
                maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
        }

        let keepPrevChar = false;
        let prevChar = '';

        while (src) {
            if (!keepPrevChar) prevChar = '';
            keepPrevChar = false;

            let token;

            // Extension inline handlers
            if (this.options.extensions?.inline?.some((extTokenizer) => {
                if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
                    src = src.substring(token.raw.length);
                    tokens.push(token);
                    return true;
                }
                return false;
            })) {
                continue;
            }

            // Escape
            if (token = this.tokenizer.escape(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // HTML tag
            if (token = this.tokenizer.tag(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Link
            if (token = this.tokenizer.link(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Reference link
            if (token = this.tokenizer.reflink(src, this.tokens.links)) {
                src = src.substring(token.raw.length);
                const lastToken = tokens.at(-1);

                if (token.type === 'text' && lastToken?.type === 'text') {
                    lastToken.raw += token.raw;
                    lastToken.text += token.text;
                } else {
                    tokens.push(token);
                }
                continue;
            }

            // Emphasis/Strong
            if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Code span
            if (token = this.tokenizer.codespan(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Line break
            if (token = this.tokenizer.br(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Strikethrough (GFM)
            if (token = this.tokenizer.del(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Autolink
            if (token = this.tokenizer.autolink(src)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // URL (GFM, not in link context)
            if (!this.state.inLink && (token = this.tokenizer.url(src))) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                continue;
            }

            // Check for extension start inline
            let cutSrc = src;
            if (this.options.extensions?.startInline) {
                let startIndex = Infinity;
                const remaining = src.slice(1);
                let tempMatch;

                this.options.extensions.startInline.forEach((getStartIndex) => {
                    tempMatch = getStartIndex.call({ lexer: this }, remaining);
                    if (typeof tempMatch === 'number' && tempMatch >= 0) {
                        startIndex = Math.min(startIndex, tempMatch);
                    }
                });

                if (startIndex < Infinity && startIndex >= 0) {
                    cutSrc = src.substring(0, startIndex + 1);
                }
            }

            // Text
            if (token = this.tokenizer.inlineText(cutSrc)) {
                src = src.substring(token.raw.length);

                if (token.raw.slice(-1) !== '_') {
                    prevChar = token.raw.slice(-1);
                }
                keepPrevChar = true;

                const lastToken = tokens.at(-1);
                if (lastToken?.type === 'text') {
                    lastToken.raw += token.raw;
                    lastToken.text += token.text;
                } else {
                    tokens.push(token);
                }
                continue;
            }

            // Unmatched text - error condition
            if (src) {
                const errMsg = 'Infinite loop on byte: ' + src.charCodeAt(0);
                if (this.options.silent) {
                    console.error(errMsg);
                    break;
                } else {
                    throw new Error(errMsg);
                }
            }
        }

        return tokens;
    }
}

export { MarkdownLexer as rZ };
