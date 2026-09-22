#!/usr/bin/env node
// Builds public/tv-lineups.json: for every film on a curated list, the stream a browser can
// play and how long it runs, from its Archive.org record. The television schedule needs a
// length for every film, and asking Archive.org at request time is too slow.
//
//   npm run tv            measure films not yet recorded
//   npm run tv -- --fresh  ask Archive.org about every film again
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLineups, saveLineups, measure } from './measure.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fresh = process.argv.includes('--fresh');
const listsDir = path.join(root, 'src/lists');
const ids = [...new Set(fs.readdirSync(listsDir).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(fs.readFileSync(path.join(listsDir, f), 'utf8')).films.map(x => x.id)))];
const lineups = fresh ? {} : loadLineups();

let asked = 0;
for (const id of ids) {
  if (lineups[id]) continue;
  asked++;
  try {
    const record = await measure(id, lineups);
    console.log(`${id}: ${record.file ? `${Math.round(record.seconds / 60)} min, ${record.file}` : 'no playable file'}`);
  } catch (error) {
    console.log(`${id}: ${error.message} (kept for next time)`);
  }
}
saveLineups(lineups);
const airable = ids.filter(id => lineups[id]?.seconds > 0).length;
console.log(`\n${ids.length} films on lists, ${airable} can air, asked Archive.org about ${asked}.`);
