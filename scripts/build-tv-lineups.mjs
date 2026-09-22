#!/usr/bin/env node
// Builds public/tv-lineups.json: for every film on a curated list, the stream a browser can
// play and how long it runs, from its Archive.org record. The television schedule needs a
// length for every film, and asking Archive.org at request time is too slow.
//
//   npm run tv            refresh films not yet recorded
//   npm run tv -- --fresh  ask Archive.org about every film again
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { pickPlayableFile } = await import(path.join(root, 'src/services/playback.js'));
const OUT = path.join(root, 'public/tv-lineups.json');
const fresh = process.argv.includes('--fresh');

const listsDir = path.join(root, 'src/lists');
const ids = [...new Set(fs.readdirSync(listsDir).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(fs.readFileSync(path.join(listsDir, f), 'utf8')).films.map(x => x.id)))];
const lineups = fresh || !fs.existsSync(OUT) ? {} : JSON.parse(fs.readFileSync(OUT, 'utf8')).films;

let asked = 0;
for (const id of ids) {
  if (lineups[id] && !fresh) continue;
  asked++;
  try {
    const data = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`).then(r => (r.ok ? r.json() : null));
    const file = data?.files ? pickPlayableFile(data.files) : null;
    lineups[id] = file ? { seconds: Math.round(Number(file.length) || 0), file: file.name } : { missing: 1 };
    console.log(`${id}: ${file ? `${Math.round(file.length / 60)} min, ${file.name}` : 'no playable file'}`);
  } catch (error) {
    console.log(`${id}: ${error.message} (kept for next time)`);
  }
  await new Promise(r => setTimeout(r, 250)); // be kind to Archive.org
}

fs.writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString(), films: lineups }));
const airable = Object.values(lineups).filter(f => f.seconds > 0).length;
console.log(`\n${ids.length} films on lists, ${airable} can air, asked Archive.org about ${asked}. ${OUT}`);

