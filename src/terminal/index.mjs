/**
 * Terminal module entry point
 * Terminal UI, input handling, and markdown rendering
 */

// UI exports
export {
  showWelcome,
  print,
  prompt,
  close,
  showError,
  showResponse,
  showKeyboardHelp,
  getReadlineInterface,
  getKeyboardIntegration
} from './ui.mjs'

// Renderer exports
export {
  TextRenderer,
  renderToken,
  renderToTerminal,
  renderToTerminalAsync,
  sanitizeMarkdown,
  getListMarker,
  getMarkedLexer,
  ALPHA_MARKERS,
  ROMAN_MARKERS,
  CONTEXT_TAG_NAMES
} from './renderer.mjs'

export default await import('./ui.mjs')
