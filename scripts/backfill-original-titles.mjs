#!/usr/bin/env node
// Adds `o` (the original title, when it differs from the English one) to every identified
// entry in public/poster-index.json that lacks it, from TMDB. New decisions carry it already
// (decisionToEntry); this is for the ones made before. One request per film, about 50 a second.
//
//   node scripts/backfill-original-titles.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/poster-index.json');
const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY || readKey();
if (!key) { console.error('Set TMDB_API_KEY'); process.exit(1); }

function readKey() {
  for (const file of ['.env.local', '.env', '../.env']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const line = fs.readFileSync(full, 'utf8').split('\n').find(l => /^(VITE_)?TMDB_API_KEY=/.test(l));
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const index = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const todo = Object.entries(index.films).filter(([, e]) => e.i && e.o === undefined && !e.oChecked);
console.log(`${todo.length} entries to check`);
let added = 0, done = 0;
const byId = new Map(); // one request per TMDB film, however many uploads it has
for (let i = 0; i < todo.length; i += 40) {
  const batch = todo.slice(i, i + 40);
  await Promise.all(batch.map(async ([, e]) => {
    if (!byId.has(e.i)) byId.set(e.i, fetch(`https://api.themoviedb.org/3/movie/${e.i}?api_key=${key}`).then(r => (r.ok ? r.json() : null)).catch(() => null));
    const film = await byId.get(e.i);
    if (!film) return;
    if (film.original_title && film.original_title !== e.t) { e.o = film.original_title; added++; } else e.oChecked = 1;
    done++;
  }));
  if (i % 800 === 0) { process.stdout.write(`\r${done} checked, ${added} original titles`); fs.writeFileSync(OUT, JSON.stringify(index)); }
  await new Promise(r => setTimeout(r, 250));
}
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`\nDone. ${done} checked, ${added} entries now carry an original title.`);
