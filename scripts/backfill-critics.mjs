#!/usr/bin/env node
// Adds the critics' score to every film on a channel (the lists in src/lists): `rt`, the Rotten
// Tomatoes score in percent, or null when there is none. TMDB gives the film's IMDb id, OMDb the
// score for it. Only entries without `rt` are asked, so a rerun after `npm run stations` is cheap.
// OMDb's free key allows 1,000 requests a day; the channels hold about 300 films.
//
//   node scripts/backfill-critics.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/poster-index.json');

function readKey(name) {
  if (process.env[name]) return process.env[name];
  for (const file of ['.env.local', '.env', '../.env']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const line = fs.readFileSync(full, 'utf8').split('\n').find(l => new RegExp(`^(VITE_)?${name}=`).test(l));
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  return null;
}
const TMDB = readKey('TMDB_API_KEY');
const OMDB = readKey('OMDB_API_KEY');
if (!TMDB || !OMDB) { console.error('Needs TMDB_API_KEY and OMDB_API_KEY'); process.exit(1); }

// "75%" -> 75; Metacritic's "68/100" when Rotten Tomatoes has nothing
export function criticScore(ratings = []) {
  const rt = ratings.find(r => r.Source === 'Rotten Tomatoes')?.Value;
  if (rt) return Number.parseInt(rt, 10);
  const mc = ratings.find(r => r.Source === 'Metacritic')?.Value;
  return mc ? Number.parseInt(mc, 10) : null;
}

const index = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const listsDir = path.join(root, 'src/lists');
const onChannels = new Set(fs.readdirSync(listsDir).filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(listsDir, f), 'utf8')).films.map(film => film.id)));
const todo = [...onChannels].map(id => index.films[id]).filter(e => e?.i && e.rt === undefined);
console.log(`${todo.length} films to ask about`);

let found = 0;
for (const entry of todo) {
  const ids = await fetch(`https://api.themoviedb.org/3/movie/${entry.i}/external_ids?api_key=${TMDB}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!ids) continue; // a network failure: leave it for the next run
  const film = ids.imdb_id ? await fetch(`https://www.omdbapi.com/?i=${ids.imdb_id}&apikey=${OMDB}`).then(r => r.json()).catch(() => null) : { Ratings: [] };
  if (!film || film.Error === 'Request limit reached!') break;
  entry.rt = criticScore(film.Ratings);
  if (entry.rt !== null) found++;
  await new Promise(r => setTimeout(r, 120));
}
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`Done. ${found} of ${todo.length} have a critics' score.`);
