#!/usr/bin/env node
// Records how long each identified upload actually runs, `d` in minutes, from its Archive.org
// file list. `l` is the film's length from TMDB; a trailer of The Shining carries l = 144 and
// d = 1, and only d can tell the two apart. 0 means Archive.org lists no video with a length.
// Only entries without `d` are fetched, so a rerun is cheap.
//
//   node scripts/backfill-upload-length.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/poster-index.json');
const VIDEO = /\.(mp4|m4v|mkv|avi|ogv|mpg|mpeg|mov|wmv|webm)$/i;

const seconds = (length) => {
  if (!length) return 0;
  const parts = String(length).split(':').map(Number);
  return parts.length > 1 ? parts.reduce((total, part) => total * 60 + part, 0) : Number(length) || 0;
};

// The item's file list as XML from the download host, which answers when the metadata API is
// rate-limiting us. <file name="x.mp4" ...><length>4058.25</length></file>
async function minutesOf(identifier) {
  const xml = await fetch(`https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(identifier)}_files.xml`, { signal: AbortSignal.timeout(15000) }).then(r => (r.ok ? r.text() : null));
  if (xml === null) return null; // unreachable now; leave the entry for the next run
  let longest = 0;
  for (const [, name, body] of xml.matchAll(/<file name="([^"]*)"[^>]*>([\s\S]*?)<\/file>/g)) {
    if (VIDEO.test(name)) longest = Math.max(longest, seconds(body.match(/<length>([^<]*)<\/length>/)?.[1]));
  }
  return Math.round(longest / 60);
}

const index = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const lineups = JSON.parse(fs.readFileSync(path.join(root, 'public/tv-lineups.json'), 'utf8')).films; // the television scripts measured these already
for (const [id, record] of Object.entries(lineups)) if (index.films[id]?.i && index.films[id].d === undefined && record.seconds > 0) index.films[id].d = Math.round(record.seconds / 60);
const todo = Object.entries(index.films).filter(([, e]) => e.i && e.d === undefined);
console.log(`${todo.length} uploads to measure`);
let done = 0, shorts = 0;
for (let i = 0; i < todo.length; i += 12) {
  await Promise.all(todo.slice(i, i + 12).map(async ([id, e]) => {
    const d = await minutesOf(id).catch(() => null);
    if (d === null) return;
    e.d = d; done++;
    if (d > 0 && d < 40) shorts++;
  }));
  if (i % 300 === 0) { console.log(`${done} measured`); fs.writeFileSync(OUT, JSON.stringify(index)); }
  await new Promise(r => setTimeout(r, 100));
}
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`\nDone. ${done} measured, ${shorts} of them shorter than 40 minutes.`);
