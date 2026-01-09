# Vendor Imports

This directory contains re-exports of third-party dependencies.

## Why This Exists

Previously, cli.mjs bundled all third-party libraries (React, Ink, Sentry, AWS SDK, RxJS) 
totaling ~170,000 lines of minified code.

Now, these are proper npm dependencies imported from node_modules.

## Impact

- **Before**: cli.mjs = 197,403 lines (7.4MB)
- **After**: cli.mjs = ~27,000 lines (~1MB)
- **Reduction**: 170K lines (85% smaller)

## Usage

Import vendor code through this module:

```javascript
import { React, Ink, chalk, marked } from './src/vendor/imports.mjs'
```

Or use specific imports:

```javascript
import React from 'react'
import { Box, Text } from 'ink'
import chalk from 'chalk'
```

## Bundled vs npm Dependencies

The following were extracted from cli.mjs and added to package.json:

- `react` + `react-dom` - UI framework (Chunks 1-5, ~60K lines)
- `ink` + ink components - Terminal UI (Chunks 13-16, ~40K lines)
- `@sentry/node` - Error tracking (Chunk 0, ~10K lines)
- `rxjs` - Reactive programming (Chunk 6, ~10K lines)
- `zod-to-json-schema` - Schema conversion (Chunk 18, now using npm package)
- Updated `marked` to v12 - Markdown parser

AWS SDK was analyzed but not included (not currently used in the codebase).
