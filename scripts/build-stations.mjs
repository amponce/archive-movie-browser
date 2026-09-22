#!/usr/bin/env node
// Generated channels. Each station is a rule (a genre, a span of decades, how many films) and this
// script turns it into an ordinary list in src/lists/, picked from the poster index: films the
// index identified with confidence, with a poster, in that genre and those decades, feature
// length, well regarded. Each pick's file is measured before it is accepted, because an upload
// the index matched to a feature can be a one-minute clip of it.
// Picks are seeded by the ISO week, so a station changes its films every Monday and stays put
// in between. Curated lists are never touched; a generated list says so in its file.
//
//   npm run stations           rebuild every station for this week
//   npm run stations -- --only creature-double-bill
// Then: npm run tv
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLineups, saveLineups, measure, isFeature } from './measure.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'public/poster-index.json'), 'utf8')).films;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// The rules. `genre` (or `genres`, any of) in our names; `decades` are inclusive starts; `count`
// is how many films air per week.
const STATIONS = [
  { slug: 'horror-all-night', title: 'Horror all night', blurb: 'Whatever the collections have that goes bump. Different every week.', genre: 'Horror', decades: [1920, 1990], count: 14 },
  { slug: 'universal-years', title: 'The Universal years', blurb: 'Horror and mystery from the 1930s and 40s, when the monsters wore suits.', genre: 'Horror', decades: [1930, 1940], count: 12 },
  { slug: 'atomic-age', title: 'Atomic age', blurb: 'Science fiction from the 1950s. Saucers, mutations, and a lot of desert.', genre: 'Sci-Fi', decades: [1950, 1950], count: 12 },
  { slug: 'space-and-after', title: 'Space and after', blurb: 'Science fiction from the 60s onward. Cheaper, weirder, occasionally brilliant.', genre: 'Sci-Fi', decades: [1960, 1990], count: 12 },
  { slug: 'noir-after-dark', title: 'Noir after dark', blurb: 'Shadows, cigarettes and bad decisions. Crime, thrillers and mysteries from the 40s and 50s.', genres: ['Crime', 'Thriller', 'Mystery'], decades: [1940, 1950], count: 12 },
  { slug: 'crime-and-punishment', title: 'Crime and punishment', blurb: 'Gangsters, heists and the police who catch up with them.', genre: 'Crime', decades: [1930, 1970], count: 12 },
  { slug: 'mystery-hour', title: 'Mystery hour', blurb: 'Whodunits and locked rooms from the golden age.', genre: 'Mystery', decades: [1930, 1960], count: 12 },
  { slug: 'thrills-and-spills', title: 'Thrills and spills', blurb: 'Thrillers from the 1970s and 80s. Paranoia, car chases, one last job.', genre: 'Thriller', decades: [1970, 1980], count: 12 },
  { slug: 'the-comedy-channel', title: 'The comedy channel', blurb: 'Screwball, slapstick and everything that still gets a laugh.', genre: 'Comedy', decades: [1930, 1960], count: 12 },
  { slug: 'sunday-serials', title: 'Sunday adventures', blurb: 'Swashbucklers, jungle pictures and cliffhangers.', genre: 'Adventure', decades: [1920, 1960], count: 12 },
  { slug: 'the-back-forty', title: 'The back forty', blurb: 'Westerns, round the clock. Republic, Monogram and the occasional major.', genre: 'Western', decades: [1930, 1970], count: 14 },
  { slug: 'war-stories', title: 'War stories', blurb: 'Combat, home front, and the films made while it was happening.', genre: 'War', decades: [1930, 1970], count: 12 },
  { slug: 'love-in-black-and-white', title: 'Love in black and white', blurb: 'Romance and melodrama, 1930 to 1960.', genre: 'Romance', decades: [1930, 1960], count: 12 },
  { slug: 'the-drama-department', title: 'The drama department', blurb: 'The serious ones. Courtrooms, families, second acts.', genre: 'Drama', decades: [1930, 1970], count: 12 },
  { slug: 'the-projection-booth', title: 'The projection booth', blurb: 'Documentaries and the real world on film.', genre: 'Documentary', decades: [1920, 1990], count: 12 },
  { slug: 'family-matinee', title: 'Family matinee', blurb: 'Animation and family films the whole room can watch.', genre: 'Animation', decades: [1920, 1990], count: 12 },
];

function seed() { // the ISO week, so every run in a week agrees
  const d = new Date(); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return d.getUTCFullYear() * 100 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7) + 1;
}
function shuffle(items, s) {
  let x = s >>> 0 || 1; const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) & 0x7fffffff; const j = x % (i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

const week = seed();
const lineups = loadLineups();
const listsDir = path.join(root, 'src/lists');
let written = 0;
for (const station of STATIONS) {
  if (only && station.slug !== only) continue;
  const pool = new Map(); // film id -> upload identifier, one per film
  for (const [id, e] of Object.entries(index)) {
    const wanted = station.genres || [station.genre];
    if (!e.p || e.c < 0.8 || !e.g?.some(g => wanted.includes(g)) || !e.y || e.y < station.decades[0] || e.y >= station.decades[1] + 10) continue;
    if (!(e.l >= 55) || (e.v || 0) < 5.5 || /trailer/i.test(id) || pool.has(e.i)) continue;
    pool.set(e.i, id);
  }
  // Walk the shuffled pool and keep the first `count` uploads whose file is really a feature
  const picks = [];
  for (const id of shuffle([...pool.values()], week * 31 + STATIONS.indexOf(station))) {
    if (picks.length >= station.count) break;
    try { if (isFeature(await measure(id, lineups))) picks.push(id); } catch { /* unreachable now, skip */ }
  }
  saveLineups(lineups);
  if (picks.length < 6) { console.log(`${station.slug}: only ${picks.length} films, not written`); continue; }
  const list = { slug: station.slug, title: station.title, blurb: station.blurb, curator: 'the station', generated: { rule: `${(station.genres || [station.genre]).join(' or ')} ${station.decades[0]}s–${station.decades[1]}s`, week }, films: picks.map(id => ({ id })) };
  fs.writeFileSync(path.join(listsDir, `${station.slug}.json`), `${JSON.stringify(list, null, 2)}\n`);
  written++;
  console.log(`${station.slug}: ${picks.length} of ${pool.size} films`);
}
console.log(`\nWeek ${week}: ${written} stations written. Now run: npm run tv`);
