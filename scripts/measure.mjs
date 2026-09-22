// What the television scripts know about a film's file: the stream a browser can play and how
// long it runs, from the item's Archive.org record, kept in public/tv-lineups.json so nothing is
// asked twice. Shared by build-tv-lineups and build-stations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/tv-lineups.json');
const { pickPlayableFile } = await import(path.join(root, 'src/services/playback.js'));

export const FEATURE_SECONDS = 40 * 60; // shorter than this is a trailer, a clip or a short

export function loadLineups() {
  return fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).films : {};
}
export function saveLineups(films) {
  fs.writeFileSync(OUT, JSON.stringify({ builtAt: new Date().toISOString(), films }));
}

// The record for one upload, from the cache or from Archive.org. `null` seconds means no
// playable file. Throws on a network failure so the caller can keep the old answer.
export async function measure(id, lineups) {
  if (lineups[id]) return lineups[id];
  const data = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`).then(r => (r.ok ? r.json() : null));
  const file = data?.files ? pickPlayableFile(data.files) : null;
  lineups[id] = file ? { seconds: Math.round(Number(file.length) || 0), file: file.name } : { missing: 1 };
  await new Promise(r => setTimeout(r, 250)); // be kind to Archive.org
  return lineups[id];
}

export const isFeature = record => Boolean(record?.file) && record.seconds >= FEATURE_SECONDS;
