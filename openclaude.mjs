#!/usr/bin/env node
/**
 * OpenClaude - Entry point with readable tool implementations
 *
 * This entry point automatically enables readable tool overrides.
 *
 * Usage:
 *   ./openclaude.mjs          # Run with readable tools
 *   ./openclaude.mjs --debug  # Run with debug output
 */

// Enable readable tools automatically
process.env.OPENCLAUDE_USE_READABLE_TOOLS = '1'

// Check for debug flag
if (process.argv.includes('--debug') || process.argv.includes('-d')) {
  process.env.DEBUG = 'true'
}

// Import cli.mjs which will auto-register readable tool overrides
import('./cli.mjs')
