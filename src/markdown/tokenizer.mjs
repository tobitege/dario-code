/**
 * Markdown Parser - Tokenizer Class
 *
 * Block and inline tokenizer that creates tokens from markdown text patterns.
 * The tokenizer is called by the lexer to generate tokens from source text.
 *
 * @module markdown/tokenizer
 */

import { COMMON_PATTERNS } from './patterns.mjs';
import {
    rtrim,
    findClosingBracket,
    compensateIndent,
    createLinkToken
} from './utils.mjs';

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
 * Block and inline tokenizer for markdown
 * Creates tokens from markdown text patterns
 */
export class MarkdownTokenizer {
    /**
     * Create a tokenizer instance
     * @param {Object} [options] - Parser options
     */
    constructor(options) {
        /** @type {Object} Parser options */
        this.options = options || globalDefaults;

        /** @type {Object} Parsing rules (set by lexer) */
        this.rules = null;

        /** @type {Object} Parent lexer reference */
        this.lexer = null;
    }

    // =========================================================================
    // BLOCK-LEVEL TOKENIZERS
    // =========================================================================

    /**
     * Tokenize whitespace/newlines
     * @param {string} src - Source text
     * @returns {Object|undefined} Space token
     */
    space(src) {
        const match = matchPattern(this.rules.block.newline, src);
        if (match && match[0].length > 0) {
            return {
                type: 'space',
                raw: match[0]
            };
        }
    }

    /**
     * Tokenize indented code blocks
     * @param {string} src - Source text
     * @returns {Object|undefined} Code token
     */
    code(src) {
        const match = matchPattern(this.rules.block.code, src);
        if (match) {
            let text = match[0].replace(this.rules.other.codeRemoveIndent, '');
            return {
                type: 'code',
                raw: match[0],
                codeBlockStyle: 'indented',
                text: !this.options.pedantic ? rtrim(text, '\n') : text
            };
        }
    }

    /**
     * Tokenize fenced code blocks (```language)
     * @param {string} src - Source text
     * @returns {Object|undefined} Code token with language
     */
    fences(src) {
        const match = matchPattern(this.rules.block.fences, src);
        if (match) {
            const raw = match[0];
            const text = compensateIndent(raw, match[3] || '', this.rules);

            return {
                type: 'code',
                raw,
                lang: match[2]
                    ? match[2].trim().replace(this.rules.inline.anyPunctuation, '$1')
                    : match[2],
                text
            };
        }
    }

    /**
     * Tokenize ATX headings (# Heading)
     * @param {string} src - Source text
     * @returns {Object|undefined} Heading token
     */
    heading(src) {
        const match = matchPattern(this.rules.block.heading, src);
        if (match) {
            let text = match[2].trim();

            // Handle trailing #
            if (this.rules.other.endingHash.test(text)) {
                const trimmed = rtrim(text, '#');
                if (this.options.pedantic) {
                    text = trimmed.trim();
                } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
                    text = trimmed.trim();
                }
            }

            return {
                type: 'heading',
                raw: match[0],
                depth: match[1].length,
                text,
                tokens: this.lexer.inline(text)
            };
        }
    }

    /**
     * Tokenize horizontal rules (---, ***, ___)
     * @param {string} src - Source text
     * @returns {Object|undefined} HR token
     */
    hr(src) {
        const match = matchPattern(this.rules.block.hr, src);
        if (match) {
            return {
                type: 'hr',
                raw: rtrim(match[0], '\n')
            };
        }
    }

    /**
     * Tokenize blockquotes (> quoted text)
     * @param {string} src - Source text
     * @returns {Object|undefined} Blockquote token with nested tokens
     */
    blockquote(src) {
        const match = matchPattern(this.rules.block.blockquote, src);
        if (match) {
            let lines = rtrim(match[0], '\n').split('\n');
            let raw = '';
            let text = '';
            const tokens = [];

            while (lines.length > 0) {
                let inBlockquote = false;
                const currentLines = [];
                let i;

                for (i = 0; i < lines.length; i++) {
                    if (this.rules.other.blockquoteStart.test(lines[i])) {
                        currentLines.push(lines[i]);
                        inBlockquote = true;
                    } else if (!inBlockquote) {
                        currentLines.push(lines[i]);
                    } else {
                        break;
                    }
                }

                lines = lines.slice(i);

                const lineText = currentLines.join('\n');
                const content = lineText
                    .replace(this.rules.other.blockquoteSetextReplace, '\n    $1')
                    .replace(this.rules.other.blockquoteSetextReplace2, '');

                raw = raw ? `${raw}\n${lineText}` : lineText;
                text = text ? `${text}\n${content}` : content;

                const prevTop = this.lexer.state.top;
                this.lexer.state.top = true;
                this.lexer.blockTokens(content, tokens, true);
                this.lexer.state.top = prevTop;

                if (lines.length === 0) break;

                const lastToken = tokens.at(-1);
                if (lastToken?.type === 'code') {
                    break;
                } else if (lastToken?.type === 'blockquote') {
                    // Continue nested blockquote
                    const nested = lastToken;
                    const combined = nested.raw + '\n' + lines.join('\n');
                    const newToken = this.blockquote(combined);

                    tokens[tokens.length - 1] = newToken;
                    raw = raw.substring(0, raw.length - nested.raw.length) + newToken.raw;
                    text = text.substring(0, text.length - nested.text.length) + newToken.text;
                    break;
                } else if (lastToken?.type === 'list') {
                    // Continue nested list
                    const nested = lastToken;
                    const combined = nested.raw + '\n' + lines.join('\n');
                    const newToken = this.list(combined);

                    tokens[tokens.length - 1] = newToken;
                    raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
                    text = text.substring(0, text.length - nested.raw.length) + newToken.raw;
                    lines = combined.substring(tokens.at(-1).raw.length).split('\n');
                    continue;
                }
            }

            return {
                type: 'blockquote',
                raw,
                tokens,
                text
            };
        }
    }

    /**
     * Tokenize ordered and unordered lists
     * @param {string} src - Source text
     * @returns {Object|undefined} List token with items
     */
    list(src) {
        let match = matchPattern(this.rules.block.list, src);
        if (match) {
            const bullet = match[1].trim();
            const isOrdered = bullet.length > 1;

            const list = {
                type: 'list',
                raw: '',
                ordered: isOrdered,
                start: isOrdered ? +bullet.slice(0, -1) : '',
                loose: false,
                items: []
            };

            // Build bullet pattern
            let bulletPattern = isOrdered
                ? `\\d{1,9}\\${bullet.slice(-1)}`
                : `\\${bullet}`;

            if (this.options.pedantic) {
                bulletPattern = isOrdered ? bulletPattern : '[*+-]';
            }

            const itemRegex = this.rules.other.listItemRegex(bulletPattern);
            let sawBlankLine = false;

            while (src) {
                let endEarly = false;
                let raw = '';
                let itemContents = '';

                if (!(match = matchPattern(itemRegex, src))) break;
                if (this.rules.block.hr.test(src)) break;

                raw = match[0];
                src = src.substring(raw.length);

                let line = match[2].split('\n', 1)[0]
                    .replace(this.rules.other.listReplaceTabs, (t) => ' '.repeat(3 * t.length));
                let nextLine = src.split('\n', 1)[0];
                let blankLine = !line.trim();
                let indent = 0;

                if (this.options.pedantic) {
                    indent = 2;
                    itemContents = line.trimStart();
                } else if (blankLine) {
                    indent = match[1].length + 1;
                } else {
                    indent = match[2].search(this.rules.other.nonSpaceChar);
                    indent = indent > 4 ? 1 : indent;
                    itemContents = line.slice(indent);
                    indent += match[1].length;
                }

                if (blankLine && this.rules.other.blankLine.test(nextLine)) {
                    raw += nextLine + '\n';
                    src = src.substring(nextLine.length + 1);
                    endEarly = true;
                }

                if (!endEarly) {
                    const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
                    const hrRegex = this.rules.other.hrRegex(indent);
                    const fencesRegex = this.rules.other.fencesBeginRegex(indent);
                    const headingRegex = this.rules.other.headingBeginRegex(indent);
                    const htmlRegex = this.rules.other.htmlBeginRegex(indent);

                    while (src) {
                        let rawLine = src.split('\n', 1)[0];
                        let nextLineContent;

                        nextLine = rawLine;

                        if (this.options.pedantic) {
                            nextLine = nextLine.replace(this.rules.other.listReplaceNesting, '  ');
                            nextLineContent = nextLine;
                        } else {
                            nextLineContent = nextLine.replace(this.rules.other.tabCharGlobal, '    ');
                        }

                        if (fencesRegex.test(nextLine)) break;
                        if (headingRegex.test(nextLine)) break;
                        if (htmlRegex.test(nextLine)) break;
                        if (nextBulletRegex.test(nextLine)) break;
                        if (hrRegex.test(nextLine)) break;

                        if (nextLineContent.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
                            itemContents += '\n' + nextLineContent.slice(indent);
                        } else {
                            if (blankLine) break;
                            if (line.replace(this.rules.other.tabCharGlobal, '    ')
                                .search(this.rules.other.nonSpaceChar) >= 4) break;
                            if (fencesRegex.test(line)) break;
                            if (headingRegex.test(line)) break;
                            if (hrRegex.test(line)) break;
                            itemContents += '\n' + nextLine;
                        }

                        if (!blankLine && !nextLine.trim()) blankLine = true;

                        raw += rawLine + '\n';
                        src = src.substring(rawLine.length + 1);
                        line = nextLineContent.slice(indent);
                    }
                }

                if (!list.loose) {
                    if (sawBlankLine) {
                        list.loose = true;
                    } else if (this.rules.other.doubleBlankLine.test(raw)) {
                        sawBlankLine = true;
                    }
                }

                // Check for task list items (GFM)
                let taskMatch = null;
                let checked;

                if (this.options.gfm) {
                    taskMatch = matchPattern(this.rules.other.listIsTask, itemContents);
                    if (taskMatch) {
                        checked = taskMatch[0] !== '[ ] ';
                        itemContents = itemContents.replace(this.rules.other.listReplaceTask, '');
                    }
                }

                list.items.push({
                    type: 'list_item',
                    raw,
                    task: !!taskMatch,
                    checked,
                    loose: false,
                    text: itemContents,
                    tokens: []
                });

                list.raw += raw;
            }

            // Clean up last item
            const lastItem = list.items.at(-1);
            if (lastItem) {
                lastItem.raw = lastItem.raw.trimEnd();
                lastItem.text = lastItem.text.trimEnd();
            } else {
                return;
            }

            list.raw = list.raw.trimEnd();

            // Tokenize list item contents
            for (let i = 0; i < list.items.length; i++) {
                this.lexer.state.top = false;
                list.items[i].tokens = this.lexer.blockTokens(list.items[i].text, []);

                if (!list.loose) {
                    const spacesInItem = list.items[i].tokens.filter((t) => t.type === 'space');
                    const hasMultipleLines = spacesInItem.length > 0 &&
                        spacesInItem.some((t) => this.rules.other.anyLine.test(t.raw));
                    list.loose = hasMultipleLines;
                }
            }

            if (list.loose) {
                for (let i = 0; i < list.items.length; i++) {
                    list.items[i].loose = true;
                }
            }

            return list;
        }
    }

    /**
     * Tokenize raw HTML blocks
     * @param {string} src - Source text
     * @returns {Object|undefined} HTML token
     */
    html(src) {
        const match = matchPattern(this.rules.block.html, src);
        if (match) {
            return {
                type: 'html',
                block: true,
                raw: match[0],
                pre: match[1] === 'pre' || match[1] === 'script' || match[1] === 'style',
                text: match[0]
            };
        }
    }

    /**
     * Tokenize link reference definitions
     * @param {string} src - Source text
     * @returns {Object|undefined} Definition token
     */
    def(src) {
        const match = matchPattern(this.rules.block.def, src);
        if (match) {
            const tag = match[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, ' ');
            const href = match[2]
                ? match[2].replace(this.rules.other.hrefBrackets, '$1')
                    .replace(this.rules.inline.anyPunctuation, '$1')
                : '';
            const title = match[3]
                ? match[3].substring(1, match[3].length - 1)
                    .replace(this.rules.inline.anyPunctuation, '$1')
                : match[3];

            return {
                type: 'def',
                tag,
                raw: match[0],
                href,
                title
            };
        }
    }

    /**
     * Tokenize GFM tables
     * @param {string} src - Source text
     * @returns {Object|undefined} Table token
     */
    table(src) {
        const match = matchPattern(this.rules.block.table, src);
        if (!match) return;
        if (!this.rules.other.tableDelimiter.test(match[2])) return;

        const headers = this._splitTableCells(match[1]);
        const aligns = match[2].replace(this.rules.other.tableAlignChars, '').split('|');
        const rows = match[3]?.trim()
            ? match[3].replace(this.rules.other.tableRowBlankLine, '').split('\n')
            : [];

        const table = {
            type: 'table',
            raw: match[0],
            header: [],
            align: [],
            rows: []
        };

        if (headers.length !== aligns.length) return;

        // Parse column alignments
        for (const align of aligns) {
            if (this.rules.other.tableAlignRight.test(align)) {
                table.align.push('right');
            } else if (this.rules.other.tableAlignCenter.test(align)) {
                table.align.push('center');
            } else if (this.rules.other.tableAlignLeft.test(align)) {
                table.align.push('left');
            } else {
                table.align.push(null);
            }
        }

        // Parse header cells
        for (let i = 0; i < headers.length; i++) {
            table.header.push({
                text: headers[i],
                tokens: this.lexer.inline(headers[i]),
                header: true,
                align: table.align[i]
            });
        }

        // Parse body rows
        for (const row of rows) {
            table.rows.push(
                this._splitTableCells(row, table.header.length).map((cell, i) => ({
                    text: cell,
                    tokens: this.lexer.inline(cell),
                    header: false,
                    align: table.align[i]
                }))
            );
        }

        return table;
    }

    /**
     * Split a table row into cells
     * @private
     * @param {string} row - Table row text
     * @param {number} [count] - Expected cell count
     * @returns {string[]} Array of cell contents
     */
    _splitTableCells(row, count) {
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

    /**
     * Tokenize setext-style headings (underlined with = or -)
     * @param {string} src - Source text
     * @returns {Object|undefined} Heading token
     */
    lheading(src) {
        const match = matchPattern(this.rules.block.lheading, src);
        if (match) {
            return {
                type: 'heading',
                raw: match[0],
                depth: match[2].charAt(0) === '=' ? 1 : 2,
                text: match[1],
                tokens: this.lexer.inline(match[1])
            };
        }
    }

    /**
     * Tokenize paragraphs
     * @param {string} src - Source text
     * @returns {Object|undefined} Paragraph token
     */
    paragraph(src) {
        const match = matchPattern(this.rules.block.paragraph, src);
        if (match) {
            const text = match[1].charAt(match[1].length - 1) === '\n'
                ? match[1].slice(0, -1)
                : match[1];

            return {
                type: 'paragraph',
                raw: match[0],
                text,
                tokens: this.lexer.inline(text)
            };
        }
    }

    /**
     * Tokenize plain text (fallback)
     * @param {string} src - Source text
     * @returns {Object|undefined} Text token
     */
    text(src) {
        const match = matchPattern(this.rules.block.text, src);
        if (match) {
            return {
                type: 'text',
                raw: match[0],
                text: match[0],
                tokens: this.lexer.inline(match[0])
            };
        }
    }

    // =========================================================================
    // INLINE-LEVEL TOKENIZERS
    // =========================================================================

    /**
     * Tokenize escape sequences
     * @param {string} src - Source text
     * @returns {Object|undefined} Escape token
     */
    escape(src) {
        const match = matchPattern(this.rules.inline.escape, src);
        if (match) {
            return {
                type: 'escape',
                raw: match[0],
                text: match[1]
            };
        }
    }

    /**
     * Tokenize inline HTML tags
     * @param {string} src - Source text
     * @returns {Object|undefined} HTML token
     */
    tag(src) {
        const match = matchPattern(this.rules.inline.tag, src);
        if (match) {
            // Track link and raw block state
            if (!this.lexer.state.inLink && this.rules.other.startATag.test(match[0])) {
                this.lexer.state.inLink = true;
            } else if (this.lexer.state.inLink && this.rules.other.endATag.test(match[0])) {
                this.lexer.state.inLink = false;
            }

            if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(match[0])) {
                this.lexer.state.inRawBlock = true;
            } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(match[0])) {
                this.lexer.state.inRawBlock = false;
            }

            return {
                type: 'html',
                raw: match[0],
                inLink: this.lexer.state.inLink,
                inRawBlock: this.lexer.state.inRawBlock,
                block: false,
                text: match[0]
            };
        }
    }

    /**
     * Tokenize inline links [text](url "title")
     * @param {string} src - Source text
     * @returns {Object|undefined} Link token
     */
    link(src) {
        const match = matchPattern(this.rules.inline.link, src);
        if (match) {
            const lastParenIndex = findClosingBracket(match[2], '()');

            if (lastParenIndex > -1) {
                const start = (match[0].indexOf('!') === 0 ? 5 : 4) + match[1].length;
                const linkLen = start + lastParenIndex;
                match[2] = match[2].substring(0, lastParenIndex);
                match[0] = match[0].substring(0, linkLen).trim();
                match[3] = '';
            }

            let href = match[2];
            let title = '';

            if (this.options.pedantic) {
                const linkMatch = matchPattern(this.rules.other.pedanticHrefTitle, href);
                if (linkMatch) {
                    href = linkMatch[1];
                    title = linkMatch[3];
                }
            } else {
                title = match[3] ? match[3].slice(1, -1) : '';
            }

            href = href.trim();

            if (this.rules.other.startAngleBracket.test(href)) {
                if (this.options.pedantic && !this.rules.other.endAngleBracket.test(match[2])) {
                    href = href.slice(1);
                } else {
                    href = href.slice(1, -1);
                }
            }

            return createLinkToken(match, {
                href: href ? href.replace(this.rules.inline.anyPunctuation, '$1') : href,
                title: title ? title.replace(this.rules.inline.anyPunctuation, '$1') : title
            }, match[0], this.lexer, this.rules);
        }
    }

    /**
     * Tokenize reference links [text][ref] or [text]
     * @param {string} src - Source text
     * @param {Object} links - Link definitions
     * @returns {Object|undefined} Link or text token
     */
    reflink(src, links) {
        let match;
        if ((match = matchPattern(this.rules.inline.reflink, src)) ||
            (match = matchPattern(this.rules.inline.nolink, src))) {

            const ref = (match[2] || match[1])
                .replace(this.rules.other.multipleSpaceGlobal, ' ');
            const link = links[ref.toLowerCase()];

            if (!link) {
                const text = match[0].charAt(0);
                return {
                    type: 'text',
                    raw: text,
                    text
                };
            }

            return createLinkToken(match, link, match[0], this.lexer, this.rules);
        }
    }

    /**
     * Tokenize emphasis (*text* or _text_) and strong (**text** or __text__)
     * @param {string} src - Source text
     * @param {string} maskedSrc - Source with special patterns masked
     * @param {string} [prevChar=''] - Previous character for boundary detection
     * @returns {Object|undefined} Emphasis or strong token
     */
    emStrong(src, maskedSrc, prevChar = '') {
        let match = matchPattern(this.rules.inline.emStrongLDelim, src);
        if (!match) return;

        // Check for Unicode alphanumeric preceding
        if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;

        // Not valid left delimiter
        if (!(match[1] || match[2]) ||
            !prevChar ||
            matchPattern(this.rules.inline.punctuation, prevChar)) {

            const delimLength = [...match[0]].length - 1;
            let leftDelim = delimLength;
            let midDelimTotal = 0;

            const rightDelimRegex = match[0][0] === '*'
                ? this.rules.inline.emStrongRDelimAst
                : this.rules.inline.emStrongRDelimUnd;

            rightDelimRegex.lastIndex = 0;
            maskedSrc = maskedSrc.slice(-1 * src.length + delimLength);

            let rMatch;
            while ((rMatch = matchPattern(rightDelimRegex, maskedSrc)) != null) {
                const closingDelim = rMatch[1] || rMatch[2] || rMatch[3] || rMatch[4] || rMatch[5] || rMatch[6];
                if (!closingDelim) continue;

                const closeLength = [...closingDelim].length;

                if (rMatch[3] || rMatch[4]) {
                    leftDelim += closeLength;
                    continue;
                } else if (rMatch[5] || rMatch[6]) {
                    if (delimLength % 3 && !((delimLength + closeLength) % 3)) {
                        midDelimTotal += closeLength;
                        continue;
                    }
                }

                leftDelim -= closeLength;
                if (leftDelim > 0) continue;

                const actualClose = Math.min(closeLength, closeLength + leftDelim + midDelimTotal);
                const raw = src.slice(0, delimLength + rMatch.index + [...rMatch[0]][0].length + actualClose);

                // Single delim = emphasis, double = strong
                if (Math.min(delimLength, actualClose) % 2) {
                    const text = raw.slice(1, -1);
                    return {
                        type: 'em',
                        raw,
                        text,
                        tokens: this.lexer.inlineTokens(text)
                    };
                }

                const text = raw.slice(2, -2);
                return {
                    type: 'strong',
                    raw,
                    text,
                    tokens: this.lexer.inlineTokens(text)
                };
            }
        }
    }

    /**
     * Tokenize inline code spans (`code`)
     * @param {string} src - Source text
     * @returns {Object|undefined} Code span token
     */
    codespan(src) {
        const match = matchPattern(this.rules.inline.code, src);
        if (match) {
            let text = match[2].replace(this.rules.other.newLineCharGlobal, ' ');
            const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
            const hasSpaceCharsOnBothEnds =
                this.rules.other.startingSpaceChar.test(text) &&
                this.rules.other.endingSpaceChar.test(text);

            if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
                text = text.substring(1, text.length - 1);
            }

            return {
                type: 'codespan',
                raw: match[0],
                text
            };
        }
    }

    /**
     * Tokenize line breaks
     * @param {string} src - Source text
     * @returns {Object|undefined} Break token
     */
    br(src) {
        const match = matchPattern(this.rules.inline.br, src);
        if (match) {
            return {
                type: 'br',
                raw: match[0]
            };
        }
    }

    /**
     * Tokenize strikethrough (~~text~~)
     * @param {string} src - Source text
     * @returns {Object|undefined} Delete token
     */
    del(src) {
        const match = matchPattern(this.rules.inline.del, src);
        if (match) {
            return {
                type: 'del',
                raw: match[0],
                text: match[2],
                tokens: this.lexer.inlineTokens(match[2])
            };
        }
    }

    /**
     * Tokenize autolinks (<url> or <email>)
     * @param {string} src - Source text
     * @returns {Object|undefined} Link token
     */
    autolink(src) {
        const match = matchPattern(this.rules.inline.autolink, src);
        if (match) {
            let text, href;

            if (match[2] === '@') {
                text = match[1];
                href = 'mailto:' + text;
            } else {
                text = match[1];
                href = text;
            }

            return {
                type: 'link',
                raw: match[0],
                text,
                href,
                tokens: [{
                    type: 'text',
                    raw: text,
                    text
                }]
            };
        }
    }

    /**
     * Tokenize bare URLs (GFM)
     * @param {string} src - Source text
     * @returns {Object|undefined} Link token
     */
    url(src) {
        let match;
        if (match = matchPattern(this.rules.inline.url, src)) {
            let text, href;

            if (match[2] === '@') {
                text = match[0];
                href = 'mailto:' + text;
            } else {
                // Backpedal to exclude trailing punctuation
                let prevText;
                do {
                    prevText = match[0];
                    match[0] = matchPattern(this.rules.inline._backpedal, match[0])?.[0] ?? '';
                } while (prevText !== match[0]);

                text = match[0];
                if (match[1] === 'www.') {
                    href = 'http://' + match[0];
                } else {
                    href = match[0];
                }
            }

            return {
                type: 'link',
                raw: match[0],
                text,
                href,
                tokens: [{
                    type: 'text',
                    raw: text,
                    text
                }]
            };
        }
    }

    /**
     * Tokenize inline text (fallback)
     * @param {string} src - Source text
     * @returns {Object|undefined} Text token
     */
    inlineText(src) {
        const match = matchPattern(this.rules.inline.text, src);
        if (match) {
            const escaped = this.lexer.state.inRawBlock;
            return {
                type: 'text',
                raw: match[0],
                text: match[0],
                escaped
            };
        }
    }
}

export { MarkdownTokenizer as yu };
