/**
 * Markdown Parser - Rule Sets
 *
 * Block-level and inline parsing rules for different modes:
 * - Normal: Standard markdown
 * - GFM: GitHub Flavored Markdown (tables, strikethrough, autolinks)
 * - Pedantic: Strict CommonMark compliance
 * - Breaks: GFM with soft line breaks
 *
 * @module markdown/rules
 */

import {
    NO_MATCH_REGEX,
    buildRegex,
    COMMON_PATTERNS,
    NEWLINE_PATTERN,
    CODE_PATTERN,
    FENCES_PATTERN,
    HR_PATTERN,
    HEADING_PATTERN,
    BULLET_PATTERN,
    LABEL_PATTERN,
    HTML_COMMENT_PATTERN,
    BLOCK_TAG_NAMES,
    PARAGRAPH_BASE_PATTERN,
    ESCAPE_PATTERN,
    CODE_SPAN_PATTERN,
    BR_PATTERN,
    TEXT_PATTERN,
    PUNCTUATION_PATTERN,
    PUNCTUATION_SPACE_PATTERN,
    NON_PUNCT_SPACE_PATTERN,
    BLOCK_SKIP_PATTERN,
    LINK_LABEL_PATTERN,
    GFM_PUNCTUATION_PATTERN,
    GFM_PUNCT_SPACE_PATTERN,
    GFM_NON_PUNCT_SPACE_PATTERN
} from './patterns.mjs';

// =============================================================================
// BLOCK RULES - DERIVED PATTERNS
// =============================================================================

// Setext heading pattern (underlined with = or -)
const SETEXT_HEADING_PATTERN = buildRegex(
    /^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/
)
    .replace(/bull/g, BULLET_PATTERN)
    .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
    .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
    .replace(/blockquote/g, / {0,3}>/)
    .replace(/heading/g, / {0,3}#{1,6}/)
    .replace(/html/g, / {0,3}<[^\n>]+>\n/)
    .getRegex();

// Link definition pattern
const DEF_PATTERN = buildRegex(
    /^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/
)
    .replace('label', LABEL_PATTERN)
    .replace('title', /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/)
    .getRegex();

// List start pattern
const LIST_START_PATTERN = buildRegex(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/)
    .replace(/bull/g, BULLET_PATTERN)
    .getRegex();

// HTML block pattern
const HTML_BLOCK_PATTERN = buildRegex(
    '^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$))',
    'i'
)
    .replace('comment', HTML_COMMENT_PATTERN)
    .replace('tag', BLOCK_TAG_NAMES)
    .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
    .getRegex();

// Paragraph pattern for normal mode
const PARAGRAPH_PATTERN = buildRegex(PARAGRAPH_BASE_PATTERN)
    .replace('hr', HR_PATTERN)
    .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
    .replace('|lheading', '')
    .replace('|table', '')
    .replace('blockquote', ' {0,3}>')
    .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
    .replace('list', ' {0,3}(?:[*+-]|1[.)]) ')
    .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
    .replace('tag', BLOCK_TAG_NAMES)
    .getRegex();

// Blockquote pattern
const BLOCKQUOTE_PATTERN = buildRegex(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/)
    .replace('paragraph', PARAGRAPH_PATTERN)
    .getRegex();

// GFM table pattern
const TABLE_PATTERN = buildRegex(
    '^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)'
)
    .replace('hr', HR_PATTERN)
    .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
    .replace('blockquote', ' {0,3}>')
    .replace('code', '(?: {4}| {0,3}\t)[^\\n]')
    .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
    .replace('list', ' {0,3}(?:[*+-]|1[.)]) ')
    .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
    .replace('tag', BLOCK_TAG_NAMES)
    .getRegex();

// GFM paragraph pattern (includes table)
const GFM_PARAGRAPH_PATTERN = buildRegex(PARAGRAPH_BASE_PATTERN)
    .replace('hr', HR_PATTERN)
    .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
    .replace('|lheading', '')
    .replace('table', TABLE_PATTERN)
    .replace('blockquote', ' {0,3}>')
    .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n')
    .replace('list', ' {0,3}(?:[*+-]|1[.)]) ')
    .replace('html', '</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)')
    .replace('tag', BLOCK_TAG_NAMES)
    .getRegex();

// =============================================================================
// BLOCK RULE SETS
// =============================================================================

/** Normal (default) block-level rules */
export const BLOCK_RULES_NORMAL = {
    blockquote: BLOCKQUOTE_PATTERN,
    code: CODE_PATTERN,
    def: DEF_PATTERN,
    fences: FENCES_PATTERN,
    heading: HEADING_PATTERN,
    hr: HR_PATTERN,
    html: HTML_BLOCK_PATTERN,
    lheading: SETEXT_HEADING_PATTERN,
    list: LIST_START_PATTERN,
    newline: NEWLINE_PATTERN,
    paragraph: PARAGRAPH_PATTERN,
    table: NO_MATCH_REGEX,
    text: /^[^\n]+/
};

/** GFM block-level rules */
export const BLOCK_RULES_GFM = {
    ...BLOCK_RULES_NORMAL,
    table: TABLE_PATTERN,
    paragraph: GFM_PARAGRAPH_PATTERN
};

/** Pedantic mode block-level rules */
export const BLOCK_RULES_PEDANTIC = {
    ...BLOCK_RULES_NORMAL,
    html: buildRegex(
        `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
    )
        .replace('comment', HTML_COMMENT_PATTERN)
        .replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b")
        .getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^(#{1,6})(.*)(?:\n+|$)/,
    fences: NO_MATCH_REGEX,
    lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    paragraph: buildRegex(PARAGRAPH_BASE_PATTERN)
        .replace('hr', HR_PATTERN)
        .replace('heading', ` *#{1,6} *[^\n]`)
        .replace('lheading', SETEXT_HEADING_PATTERN)
        .replace('|table', '')
        .replace('blockquote', ' {0,3}>')
        .replace('|fences', '')
        .replace('|list', '')
        .replace('|html', '')
        .replace('|tag', '')
        .getRegex()
};

/** Block rules by mode */
export const BLOCK_RULES = {
    normal: BLOCK_RULES_NORMAL,
    gfm: BLOCK_RULES_GFM,
    pedantic: BLOCK_RULES_PEDANTIC
};

// =============================================================================
// INLINE RULES - DERIVED PATTERNS
// =============================================================================

// Autolink pattern
const AUTOLINK_PATTERN = buildRegex(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
    .replace('scheme', /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
    .replace('email', /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/)
    .getRegex();

// HTML tag pattern (inline)
const TAG_PATTERN = buildRegex(
    '^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>'
)
    .replace('comment', buildRegex(HTML_COMMENT_PATTERN).replace('(?:-->|$)', '-->').getRegex())
    .replace('attribute', /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/)
    .getRegex();

// Link pattern
const LINK_PATTERN = buildRegex(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/)
    .replace('label', LINK_LABEL_PATTERN)
    .replace('href', /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/)
    .replace('title', /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/)
    .getRegex();

// Reference link pattern
const REFLINK_PATTERN = buildRegex(/^!?\[(label)\]\[(ref)\]/)
    .replace('label', LINK_LABEL_PATTERN)
    .replace('ref', LABEL_PATTERN)
    .getRegex();

// Nolink pattern (bare reference)
const NOLINK_PATTERN = buildRegex(/^!?\[(ref)\](?:\[\])?/)
    .replace('ref', LABEL_PATTERN)
    .getRegex();

// Reflink search pattern
const REFLINK_SEARCH_PATTERN = buildRegex('reflink|nolink(?!\\()', 'g')
    .replace('reflink', REFLINK_PATTERN)
    .replace('nolink', NOLINK_PATTERN)
    .getRegex();

// Emphasis delimiters
const EM_STRONG_L_DELIM_PATTERN = buildRegex(
    /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,
    'u'
)
    .replace(/punct/g, PUNCTUATION_PATTERN)
    .getRegex();

// Right delimiter patterns for asterisk
const EM_STRONG_R_DELIM_AST = buildRegex(
    "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",
    'gu'
)
    .replace(/notPunctSpace/g, NON_PUNCT_SPACE_PATTERN)
    .replace(/punctSpace/g, PUNCTUATION_SPACE_PATTERN)
    .replace(/punct/g, PUNCTUATION_PATTERN)
    .getRegex();

// Right delimiter for underscore
const EM_STRONG_R_DELIM_UND = buildRegex(
    "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
    'gu'
)
    .replace(/notPunctSpace/g, NON_PUNCT_SPACE_PATTERN)
    .replace(/punctSpace/g, PUNCTUATION_SPACE_PATTERN)
    .replace(/punct/g, PUNCTUATION_PATTERN)
    .getRegex();

// Any punctuation pattern
const ANY_PUNCTUATION_PATTERN = buildRegex(/\\(punct)/, 'gu')
    .replace(/punct/g, PUNCTUATION_PATTERN)
    .getRegex();

// Punctuation for inline
const INLINE_PUNCTUATION_PATTERN = buildRegex(/^((?![*_])punctSpace)/, 'u')
    .replace(/punctSpace/g, PUNCTUATION_SPACE_PATTERN)
    .getRegex();

// GFM emphasis delimiters
const GFM_EM_STRONG_L_DELIM = buildRegex(
    /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,
    'u'
)
    .replace(/punct/g, GFM_PUNCTUATION_PATTERN)
    .getRegex();

const GFM_EM_STRONG_R_DELIM_AST = buildRegex(
    "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",
    'gu'
)
    .replace(/notPunctSpace/g, GFM_NON_PUNCT_SPACE_PATTERN)
    .replace(/punctSpace/g, GFM_PUNCT_SPACE_PATTERN)
    .replace(/punct/g, GFM_PUNCTUATION_PATTERN)
    .getRegex();

// =============================================================================
// INLINE RULE SETS
// =============================================================================

/** Normal inline rules */
export const INLINE_RULES_NORMAL = {
    _backpedal: NO_MATCH_REGEX,
    anyPunctuation: ANY_PUNCTUATION_PATTERN,
    autolink: AUTOLINK_PATTERN,
    blockSkip: BLOCK_SKIP_PATTERN,
    br: BR_PATTERN,
    code: CODE_SPAN_PATTERN,
    del: NO_MATCH_REGEX,
    emStrongLDelim: EM_STRONG_L_DELIM_PATTERN,
    emStrongRDelimAst: EM_STRONG_R_DELIM_AST,
    emStrongRDelimUnd: EM_STRONG_R_DELIM_UND,
    escape: ESCAPE_PATTERN,
    link: LINK_PATTERN,
    nolink: NOLINK_PATTERN,
    punctuation: INLINE_PUNCTUATION_PATTERN,
    reflink: REFLINK_PATTERN,
    reflinkSearch: REFLINK_SEARCH_PATTERN,
    tag: TAG_PATTERN,
    text: TEXT_PATTERN,
    url: NO_MATCH_REGEX
};

/** GFM inline rules */
export const INLINE_RULES_GFM = {
    ...INLINE_RULES_NORMAL,
    emStrongRDelimAst: GFM_EM_STRONG_R_DELIM_AST,
    emStrongLDelim: GFM_EM_STRONG_L_DELIM,
    url: buildRegex(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, 'i')
        .replace('email', /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/)
        .getRegex(),
    _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
    del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
    text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};

/** Breaks mode inline rules (GFM with soft breaks) */
export const INLINE_RULES_BREAKS = {
    ...INLINE_RULES_GFM,
    br: buildRegex(BR_PATTERN).replace('{2,}', '*').getRegex(),
    text: buildRegex(INLINE_RULES_GFM.text).replace('\\b_', '\\b_| {2,}\\n').replace(/\{2,\}/g, '*').getRegex()
};

/** Pedantic inline rules */
export const INLINE_RULES_PEDANTIC = {
    ...INLINE_RULES_NORMAL,
    link: buildRegex(/^!?\[(label)\]\((.*?)\)/)
        .replace('label', LINK_LABEL_PATTERN)
        .getRegex(),
    reflink: buildRegex(/^!?\[(label)\]\s*\[([^\]]*)\]/)
        .replace('label', LINK_LABEL_PATTERN)
        .getRegex()
};

/** Inline rules by mode */
export const INLINE_RULES = {
    normal: INLINE_RULES_NORMAL,
    gfm: INLINE_RULES_GFM,
    breaks: INLINE_RULES_BREAKS,
    pedantic: INLINE_RULES_PEDANTIC
};
