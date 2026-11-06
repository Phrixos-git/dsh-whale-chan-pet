// Regenerate src/client/art.js from the standalone SVG.
// The SVG file is the single source of truth for the character art.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const svg = readFileSync(new URL('art/whale-chan.svg', root), 'utf8');
const output = `/** Generated from art/whale-chan.svg by scripts/sync-art.mjs. */\nexport const ART_SVG = ${JSON.stringify(svg)};\n`;
writeFileSync(new URL('src/client/art.js', root), output);
console.log(`synced src/client/art.js (${output.length} bytes)`);
