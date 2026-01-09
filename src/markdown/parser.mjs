/**
 * Markdown Parser - Parser Class
 *
 * The main parser that converts token arrays to rendered output.
 * Uses renderers to transform block and inline tokens to HTML or text.
 *
 * @module markdown/parser
 */

import { MarkdownRenderer, TextRenderer } from './renderer.mjs';

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
 * Markdown parser - converts tokens to rendered output
 * Orchestrates rendering of block and inline tokens
 */
export class MarkdownParser {
    /**
     * Create a parser instance
     * @param {Object} [options] - Parser options
     */
    constructor(options) {
        /** @type {Object} Parser options */
        this.options = options || globalDefaults;
        this.options.renderer = this.options.renderer || new MarkdownRenderer();

        /** @type {MarkdownRenderer} */
        this.renderer = this.options.renderer;
        this.renderer.options = this.options;
        this.renderer.parser = this;

        /** @type {TextRenderer} */
        this.textRenderer = new TextRenderer();
    }

    /**
     * Parse tokens to HTML (static helper)
     * @param {Array} tokens - Token array
     * @param {Object} [options] - Parser options
     * @returns {string} HTML output
     */
    static parse(tokens, options) {
        return new MarkdownParser(options).parse(tokens);
    }

    /**
     * Parse inline tokens to HTML (static helper)
     * @param {Array} tokens - Inline token array
     * @param {Object} [options] - Parser options
     * @returns {string} HTML output
     */
    static parseInline(tokens, options) {
        return new MarkdownParser(options).parseInline(tokens);
    }

    /**
     * Parse block-level tokens
     * @param {Array} tokens - Token array
     * @param {boolean} [top=true] - Whether at top level (wrap text in paragraphs)
     * @returns {string} HTML output
     */
    parse(tokens, top = true) {
        let out = '';

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            // Check for extension renderers
            if (this.options.extensions?.renderers?.[token.type]) {
                const genericToken = token;
                const ret = this.options.extensions.renderers[genericToken.type].call(
                    { parser: this },
                    genericToken
                );

                if (ret !== false ||
                    !['space', 'hr', 'heading', 'code', 'table', 'blockquote',
                      'list', 'html', 'paragraph', 'text'].includes(genericToken.type)) {
                    out += ret || '';
                    continue;
                }
            }

            const typedToken = token;

            switch (typedToken.type) {
                case 'space':
                    out += this.renderer.space(typedToken);
                    continue;

                case 'hr':
                    out += this.renderer.hr(typedToken);
                    continue;

                case 'heading':
                    out += this.renderer.heading(typedToken);
                    continue;

                case 'code':
                    out += this.renderer.code(typedToken);
                    continue;

                case 'table':
                    out += this.renderer.table(typedToken);
                    continue;

                case 'blockquote':
                    out += this.renderer.blockquote(typedToken);
                    continue;

                case 'list':
                    out += this.renderer.list(typedToken);
                    continue;

                case 'html':
                    out += this.renderer.html(typedToken);
                    continue;

                case 'paragraph':
                    out += this.renderer.paragraph(typedToken);
                    continue;

                case 'text': {
                    let textToken = typedToken;
                    let body = this.renderer.text(textToken);

                    // Collect consecutive text tokens
                    while (i + 1 < tokens.length && tokens[i + 1].type === 'text') {
                        textToken = tokens[++i];
                        body += '\n' + this.renderer.text(textToken);
                    }

                    if (top) {
                        out += this.renderer.paragraph({
                            type: 'paragraph',
                            raw: body,
                            text: body,
                            tokens: [{
                                type: 'text',
                                raw: body,
                                text: body,
                                escaped: true
                            }]
                        });
                    } else {
                        out += body;
                    }
                    continue;
                }

                default: {
                    const errMsg = `Token with "${typedToken.type}" type was not found.`;
                    if (this.options.silent) {
                        console.error(errMsg);
                        return '';
                    } else {
                        throw new Error(errMsg);
                    }
                }
            }
        }

        return out;
    }

    /**
     * Parse inline tokens
     * @param {Array} tokens - Inline token array
     * @param {Object} [renderer=this.renderer] - Renderer to use
     * @returns {string} HTML output
     */
    parseInline(tokens, renderer = this.renderer) {
        let out = '';

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            // Check for extension renderers
            if (this.options.extensions?.renderers?.[token.type]) {
                const ret = this.options.extensions.renderers[token.type].call(
                    { parser: this },
                    token
                );

                if (ret !== false ||
                    !['escape', 'html', 'link', 'image', 'strong', 'em',
                      'codespan', 'br', 'del', 'text'].includes(token.type)) {
                    out += ret || '';
                    continue;
                }
            }

            const typedToken = token;

            switch (typedToken.type) {
                case 'escape':
                    out += renderer.text(typedToken);
                    break;

                case 'html':
                    out += renderer.html(typedToken);
                    break;

                case 'link':
                    out += renderer.link(typedToken);
                    break;

                case 'image':
                    out += renderer.image(typedToken);
                    break;

                case 'strong':
                    out += renderer.strong(typedToken);
                    break;

                case 'em':
                    out += renderer.em(typedToken);
                    break;

                case 'codespan':
                    out += renderer.codespan(typedToken);
                    break;

                case 'br':
                    out += renderer.br(typedToken);
                    break;

                case 'del':
                    out += renderer.del(typedToken);
                    break;

                case 'text':
                    out += renderer.text(typedToken);
                    break;

                default: {
                    const errMsg = `Token with "${typedToken.type}" type was not found.`;
                    if (this.options.silent) {
                        console.error(errMsg);
                        return '';
                    } else {
                        throw new Error(errMsg);
                    }
                }
            }
        }

        return out;
    }
}

export { MarkdownParser as aZ };
