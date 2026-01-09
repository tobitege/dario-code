/**
 * Vendor Library Imports
 *
 * This module re-exports all third-party dependencies that were previously
 * bundled in cli.mjs. Now they're imported from node_modules as proper
 * npm dependencies.
 *
 * This reduces cli.mjs from 197K lines to ~27K lines.
 */

// =============================================================================
// REACT ECOSYSTEM (Previously Chunks 1-5, ~60K lines)
// =============================================================================

export { default as React } from 'react'
export * from 'react'
export { default as ReactDOM } from 'react-dom'
export * from 'react-dom'

// =============================================================================
// TERMINAL UI (Previously Chunks 13-16, ~40K lines)
// =============================================================================

export { render as renderInk, Box, Text, useInput, useApp, useStdout, useStdin } from 'ink'
export { default as TextInput } from 'ink-text-input'
export { default as SelectInput } from 'ink-select-input'
export { default as Spinner } from 'ink-spinner'

// =============================================================================
// ERROR TRACKING (Previously Chunk 0 partial, ~10K lines)
// =============================================================================

export * as Sentry from '@sentry/node'

// =============================================================================
// MARKDOWN & SYNTAX (Already in package.json, but re-export for consistency)
// =============================================================================

export { marked, lexer as markedLexer } from 'marked'
export { default as markedTerminal } from 'marked-terminal'
export { default as hljs } from 'highlight.js'

// =============================================================================
// UTILITIES
// =============================================================================

export { default as chalk } from 'chalk'
export { default as open } from 'open'
export { default as fetch } from 'node-fetch'
export { z } from 'zod'
export { zodToJsonSchema } from 'zod-to-json-schema'
export * as YAML from 'yaml'

// =============================================================================
// ANTHROPIC SDK (from npm)
// =============================================================================

export { default as Anthropic } from '@anthropic-ai/sdk'

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  // React
  React,
  ReactDOM,

  // Ink UI
  renderInk,
  Box,
  Text,
  useInput,
  useApp,
  useStdout,
  useStdin,
  TextInput,
  SelectInput,
  Spinner,

  // Error tracking
  Sentry,

  // Markdown & syntax
  marked,
  markedLexer,
  markedTerminal,
  hljs,

  // Utilities
  chalk,
  open,
  fetch,
  z,
  zodToJsonSchema,
  YAML,

  // Anthropic
  Anthropic
}
