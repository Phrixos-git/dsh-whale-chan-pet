// Embed the state sprites into the client source as data URLs.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const states = ['idle', 'think', 'sleep'];
const walk = ['walk-1', 'walk-2', 'walk-3', 'walk-4'];

function dataUrl(name) {
  const path = new URL(`art/sprites/${name}.webp`, root);
  if (!existsSync(path)) throw new Error(`missing sprite: art/sprites/${name}.webp`);
  return `data:image/webp;base64,${readFileSync(path).toString('base64')}`;
}

const lines = states.map((name) => `  ${name}: ${JSON.stringify(dataUrl(name))}`);
lines.push(`  walk: [\n${walk.map((name) => `    ${JSON.stringify(dataUrl(name))}`).join(',\n')},\n  ]`);
const output = `/** Generated from art/sprites/*.webp by scripts/sync-sprites.mjs. */\nexport const SPRITES = {\n${lines.join(',\n')},\n};\nSPRITES.blink = SPRITES.sleep;\n`;
writeFileSync(new URL('src/client/sprites.js', root), output);
console.log(`synced src/client/sprites.js (${(output.length / 1024).toFixed(0)} KiB)`);
