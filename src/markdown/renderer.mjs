/**
 * Markdown Parser - Renderer Classes
 *
 * HTML renderer and text renderer for converting tokens to output.
 *
 * @module markdown/renderer
 */

import { COMMON_PATTERNS } from './patterns.mjs';
import { escapeHtml, sanitizeUrl } from './utils.mjs';

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

// =============================================================================
// MARKDOWN RENDERER
// =============================================================================

/**
 * HTML renderer for markdown tokens
 * Converts tokens to HTML strings
 */
export class MarkdownRenderer {
    /**
     * Create a renderer instance
     * @param {Object} [options] - Renderer options
     */
    constructor(options) {
        /** @type {Object} Renderer options */
        this.options = options || globalDefaults;

        /** @type {Object} Parent parser reference */
        this.parser = null;
    }

    /**
     * Render whitespace token
     * @param {Object} token - Space token
     * @returns {string} Empty string
     */
    space(token) {
        return '';
    }

    /**
     * Render code block
     * @param {Object} token - Code token with text, lang, escaped
     * @returns {string} HTML code block
     */
    code({ text, lang, escaped }) {
        const langClass = (lang || '').match(COMMON_PATTERNS.notSpaceStart)?.[0];
        const code = text.replace(COMMON_PATTERNS.endingNewline, '') + '\n';

        if (!langClass) {
            return '<pre><code>' + (escaped ? code : escapeHtml(code, true)) + '</code></pre>\n';
        }

        return '<pre><code class="language-' + escapeHtml(langClass) + '">' +
            (escaped ? code : escapeHtml(code, true)) + '</code></pre>\n';
    }

    /**
     * Render blockquote
     * @param {Object} token - Blockquote token with nested tokens
     * @returns {string} HTML blockquote
     */
    blockquote({ tokens }) {
        return '<blockquote>\n' + this.parser.parse(tokens) + '</blockquote>\n';
    }

    /**
     * Render raw HTML
     * @param {Object} token - HTML token with text
     * @returns {string} Raw HTML
     */
    html({ text }) {
        return text;
    }

    /**
     * Render heading
     * @param {Object} token - Heading token with tokens, depth
     * @returns {string} HTML heading
     */
    heading({ tokens, depth }) {
        return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
    }

    /**
     * Render horizontal rule
     * @param {Object} token - HR token
     * @returns {string} HTML hr
     */
    hr(token) {
        return '<hr>\n';
    }

    /**
     * Render list
     * @param {Object} token - List token with items, ordered, start
     * @returns {string} HTML list
     */
    list(token) {
        const { ordered, start, items } = token;
        let body = '';

        for (let i = 0; i < items.length; i++) {
            body += this.listitem(items[i]);
        }

        const tag = ordered ? 'ol' : 'ul';
        const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';

        return `<${tag}${startAttr}>\n${body}</${tag}>\n`;
    }

    /**
     * Render list item
     * @param {Object} item - List item with tokens, task, checked, loose
     * @returns {string} HTML list item
     */
    listitem(item) {
        let prefix = '';

        if (item.task) {
            const checkbox = this.checkbox({ checked: !!item.checked });

            if (item.loose) {
                if (item.tokens[0]?.type === 'paragraph') {
                    item.tokens[0].text = checkbox + ' ' + item.tokens[0].text;
                    if (item.tokens[0].tokens?.length > 0 &&
                        item.tokens[0].tokens[0].type === 'text') {
                        item.tokens[0].tokens[0].text = checkbox + ' ' +
                            escapeHtml(item.tokens[0].tokens[0].text);
                        item.tokens[0].tokens[0].escaped = true;
                    }
                } else {
                    item.tokens.unshift({
                        type: 'text',
                        raw: checkbox + ' ',
                        text: checkbox + ' ',
                        escaped: true
                    });
                }
            } else {
                prefix += checkbox + ' ';
            }
        }

        prefix += this.parser.parse(item.tokens, !!item.loose);

        return `<li>${prefix}</li>\n`;
    }

    /**
     * Render checkbox
     * @param {Object} options - Checkbox options with checked
     * @returns {string} HTML checkbox input
     */
    checkbox({ checked }) {
        return '<input ' + (checked ? 'checked="" ' : '') + 'disabled="" type="checkbox">';
    }

    /**
     * Render paragraph
     * @param {Object} token - Paragraph token with inline tokens
     * @returns {string} HTML paragraph
     */
    paragraph({ tokens }) {
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    }

    /**
     * Render table
     * @param {Object} token - Table token with header, rows
     * @returns {string} HTML table
     */
    table(token) {
        let header = '';
        let headerCells = '';

        for (let i = 0; i < token.header.length; i++) {
            headerCells += this.tablecell(token.header[i]);
        }

        header += this.tablerow({ text: headerCells });

        let body = '';
        for (let i = 0; i < token.rows.length; i++) {
            const row = token.rows[i];
            let rowCells = '';

            for (let j = 0; j < row.length; j++) {
                rowCells += this.tablecell(row[j]);
            }

            body += this.tablerow({ text: rowCells });
        }

        if (body) body = `<tbody>${body}</tbody>`;

        return '<table>\n<thead>\n' + header + '</thead>\n' + body + '</table>\n';
    }

    /**
     * Render table row
     * @param {Object} token - Row token with text
     * @returns {string} HTML table row
     */
    tablerow({ text }) {
        return `<tr>\n${text}</tr>\n`;
    }

    /**
     * Render table cell
     * @param {Object} token - Cell token with tokens, header, align
     * @returns {string} HTML table cell
     */
    tablecell(token) {
        const content = this.parser.parseInline(token.tokens);
        const tag = token.header ? 'th' : 'td';

        return (token.align ? `<${tag} align="${token.align}">` : `<${tag}>`) +
            content + `</${tag}>\n`;
    }

    /**
     * Render strong/bold text
     * @param {Object} token - Strong token with inline tokens
     * @returns {string} HTML strong
     */
    strong({ tokens }) {
        return `<strong>${this.parser.parseInline(tokens)}</strong>`;
    }

    /**
     * Render emphasized/italic text
     * @param {Object} token - Em token with inline tokens
     * @returns {string} HTML em
     */
    em({ tokens }) {
        return `<em>${this.parser.parseInline(tokens)}</em>`;
    }

    /**
     * Render inline code
     * @param {Object} token - Codespan token with text
     * @returns {string} HTML code
     */
    codespan({ text }) {
        return `<code>${escapeHtml(text, true)}</code>`;
    }

    /**
     * Render line break
     * @param {Object} token - BR token
     * @returns {string} HTML br
     */
    br(token) {
        return '<br>';
    }

    /**
     * Render strikethrough text
     * @param {Object} token - Del token with inline tokens
     * @returns {string} HTML del
     */
    del({ tokens }) {
        return `<del>${this.parser.parseInline(tokens)}</del>`;
    }

    /**
     * Render link
     * @param {Object} token - Link token with href, title, tokens
     * @returns {string} HTML anchor
     */
    link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const cleanHref = sanitizeUrl(href);

        if (cleanHref === null) {
            return text;
        }

        let out = '<a href="' + cleanHref + '"';
        if (title) {
            out += ' title="' + escapeHtml(title) + '"';
        }
        out += '>' + text + '</a>';

        return out;
    }

    /**
     * Render image
     * @param {Object} token - Image token with href, title, text
     * @returns {string} HTML img
     */
    image({ href, title, text }) {
        const cleanHref = sanitizeUrl(href);

        if (cleanHref === null) {
            return escapeHtml(text);
        }

        let out = `<img src="${cleanHref}" alt="${text}"`;
        if (title) {
            out += ` title="${escapeHtml(title)}"`;
        }
        out += '>';

        return out;
    }

    /**
     * Render text token
     * @param {Object} token - Text token with text, tokens, escaped
     * @returns {string} HTML-safe text
     */
    text(token) {
        if ('tokens' in token && token.tokens) {
            return this.parser.parseInline(token.tokens);
        }
        if ('escaped' in token && token.escaped) {
            return token.text;
        }
        return escapeHtml(token.text);
    }
}

// =============================================================================
// TEXT RENDERER
// =============================================================================

/**
 * Plain text renderer - strips all formatting
 * Used for generating text-only output
 */
export class TextRenderer {
    /**
     * Render strong text
     * @param {Object} token - Token with text
     * @returns {string} Plain text
     */
    strong({ text }) {
        return text;
    }

    /**
     * Render emphasized text
     * @param {Object} token - Token with text
     * @returns {string} Plain text
     */
    em({ text }) {
        return text;
    }

    /**
     * Render code span
     * @param {Object} token - Token with text
     * @returns {string} Plain text
     */
    codespan({ text }) {
        return text;
    }

    /**
     * Render strikethrough
     * @param {Object} token - Token with text
     * @returns {string} Plain text
     */
    del({ text }) {
        return text;
    }

    /**
     * Render HTML
     * @param {Object} token - Token with text
     * @returns {string} Plain text (HTML preserved)
     */
    html({ text }) {
        return text;
    }

    /**
     * Render text
     * @param {Object} token - Token with text
     * @returns {string} Plain text
     */
    text({ text }) {
        return text;
    }

    /**
     * Render link
     * @param {Object} token - Token with text
     * @returns {string} Link text only
     */
    link({ text }) {
        return '' + text;
    }

    /**
     * Render image
     * @param {Object} token - Token with text
     * @returns {string} Alt text only
     */
    image({ text }) {
        return '' + text;
    }

    /**
     * Render line break
     * @returns {string} Empty string
     */
    br() {
        return '';
    }
}

export { MarkdownRenderer as Pu, TextRenderer as Po };
