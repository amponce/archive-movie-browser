#!/usr/bin/env node
// Fills in what TMDB knows about every identified film in public/poster-index.json and the
// build did not keep: `o` the original title when it differs, `g` its genres in our names,
// `l` its length in minutes. One request per film, about 50 a second, and only for entries
// that lack them, so a rerun is cheap.
//
//   node scripts/backfill-film-facts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { archiveService } = await import(path.join(root, 'src/services/archive.js'));
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
const todo = Object.entries(index.films).filter(([, e]) => e.i && e.g === undefined); // g is always set after a fill, even when empty
console.log(`${todo.length} entries to fill`);
let done = 0, genres = 0, runtimes = 0;
const byId = new Map(); // one request per TMDB film, however many uploads it has
for (let i = 0; i < todo.length; i += 40) {
  const batch = todo.slice(i, i + 40);
  await Promise.all(batch.map(async ([, e]) => {
    if (!byId.has(e.i)) byId.set(e.i, fetch(`https://api.themoviedb.org/3/movie/${e.i}?api_key=${key}`).then(r => (r.ok ? r.json() : null)).catch(() => null));
    const film = await byId.get(e.i);
    if (!film) return;
    if (film.original_title && film.original_title !== e.t) e.o = film.original_title;
    delete e.oChecked;
    const ours = [...new Set((film.genres || []).map(g => archiveService.normalizeGenre(g.name)).filter(Boolean))];
    e.g = ours; if (ours.length) genres++;
    if (film.runtime > 0) { e.l = film.runtime; runtimes++; }
    done++;
  }));
  if (i % 800 === 0) { process.stdout.write(`\r${done} filled`); fs.writeFileSync(OUT, JSON.stringify(index)); }
  await new Promise(r => setTimeout(r, 250));
}
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`\nDone. ${done} filled: ${genres} with genres, ${runtimes} with a runtime.`);
