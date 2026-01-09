#!/usr/bin/env node
/**
 * Chunk cli.mjs into smaller files for parallel analysis
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '..', 'cli.mjs');
const CHUNKS_DIR = join(__dirname, '..', 'chunks');
const CHUNK_SIZE = 10000; // lines per chunk

// Ensure chunks directory exists
if (!existsSync(CHUNKS_DIR)) {
  mkdirSync(CHUNKS_DIR, { recursive: true });
}

console.log('Reading cli.mjs...');
const content = readFileSync(CLI_PATH, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);
console.log(`Chunk size: ${CHUNK_SIZE} lines`);
console.log(`Expected chunks: ${Math.ceil(lines.length / CHUNK_SIZE)}`);

const chunks = [];

for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
  const chunkNum = Math.floor(i / CHUNK_SIZE);
  const startLine = i + 1; // 1-indexed for human readability
  const endLine = Math.min(i + CHUNK_SIZE, lines.length);
  const chunkLines = lines.slice(i, i + CHUNK_SIZE);

  const chunkPath = join(CHUNKS_DIR, `chunk-${String(chunkNum).padStart(2, '0')}.mjs`);

  // Add header comment with line info
  const header = `// Chunk ${chunkNum}: Lines ${startLine}-${endLine} of cli.mjs\n// Total lines in chunk: ${chunkLines.length}\n\n`;

  writeFileSync(chunkPath, header + chunkLines.join('\n'));

  chunks.push({
    chunk: chunkNum,
    file: `chunk-${String(chunkNum).padStart(2, '0')}.mjs`,
    startLine,
    endLine,
    lineCount: chunkLines.length
  });

  console.log(`Created chunk ${chunkNum}: lines ${startLine}-${endLine}`);
}

// Write manifest
const manifest = {
  sourceFile: 'cli.mjs',
  totalLines: lines.length,
  chunkSize: CHUNK_SIZE,
  chunks,
  createdAt: new Date().toISOString()
};

writeFileSync(join(CHUNKS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\nDone! Created ${chunks.length} chunks in ${CHUNKS_DIR}`);
console.log('Manifest written to chunks/manifest.json');
