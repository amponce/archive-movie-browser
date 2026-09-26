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
import { isTakenDown, isRecent, neverOnAir } from '../src/services/policy.js';
import { CARTOON_GENRES } from '../src/services/posterIndex.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'public/poster-index.json'), 'utf8')).films;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// The rules. `genre` (or `genres`, any of) in our names; `decades` are inclusive starts; `count`
// is how many films air per week: 32 is about two days before a film comes round again. A small
// pool gives what it has; under 6 and the station is not written.
const EVERY_GENRE = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'];
const STATIONS = [
  { slug: 'horror-all-night', title: 'Horror all night', blurb: 'Whatever the collections have that goes bump. Different every week.', genre: 'Horror', decades: [1920, 1990], count: 32 },
  { slug: 'universal-years', title: 'The Universal years', blurb: 'Horror and mystery from the 1930s and 40s, when the monsters wore suits.', genre: 'Horror', decades: [1930, 1940], count: 32 },
  { slug: 'atomic-age', title: 'Atomic age', blurb: 'Science fiction from the 1950s. Saucers, mutations, and a lot of desert.', genre: 'Sci-Fi', decades: [1950, 1950], count: 32 },
  { slug: 'space-and-after', title: 'Space and after', blurb: 'Science fiction from the 60s onward. Cheaper, weirder, occasionally brilliant.', genre: 'Sci-Fi', decades: [1960, 1990], count: 32 },
  { slug: 'noir-after-dark', title: 'Noir after dark', blurb: 'Shadows, cigarettes and bad decisions. Crime, thrillers and mysteries from the 40s and 50s.', genres: ['Crime', 'Thriller', 'Mystery'], decades: [1940, 1950], count: 32 },
  { slug: 'crime-and-punishment', title: 'Crime and punishment', blurb: 'Gangsters, heists and the police who catch up with them.', genre: 'Crime', decades: [1930, 1970], count: 32 },
  { slug: 'mystery-hour', title: 'Mystery hour', blurb: 'Whodunits and locked rooms from the golden age.', genre: 'Mystery', decades: [1930, 1960], count: 32 },
  { slug: 'thrills-and-spills', title: 'Thrills and spills', blurb: 'Thrillers from the 1970s and 80s. Paranoia, car chases, one last job.', genre: 'Thriller', decades: [1970, 1980], count: 32 },
  { slug: 'the-comedy-channel', title: 'The comedy channel', blurb: 'Screwball, slapstick and everything that still gets a laugh.', genre: 'Comedy', decades: [1930, 1960], count: 32 },
  { slug: 'sunday-serials', title: 'Sunday adventures', blurb: 'Swashbucklers, jungle pictures and cliffhangers.', genre: 'Adventure', decades: [1920, 1960], count: 32 },
  { slug: 'the-back-forty', title: 'The back forty', blurb: 'Westerns, round the clock. Republic, Monogram and the occasional major.', genre: 'Western', decades: [1930, 1970], count: 32 },
  { slug: 'war-stories', title: 'War stories', blurb: 'Combat, home front, and the films made while it was happening.', genre: 'War', decades: [1930, 1970], count: 32 },
  { slug: 'love-in-black-and-white', title: 'Love in black and white', blurb: 'Romance and melodrama, 1930 to 1960.', genre: 'Romance', decades: [1930, 1960], count: 32 },
  { slug: 'the-drama-department', title: 'The drama department', blurb: 'The serious ones. Courtrooms, families, second acts.', genre: 'Drama', decades: [1930, 1970], count: 32 },
  { slug: 'the-projection-booth', title: 'The projection booth', blurb: 'Documentaries and the real world on film.', genre: 'Documentary', decades: [1920, 1990], count: 32 },
  { slug: 'where-horror-started', title: 'Where horror started', blurb: 'Horror before sound: Caligari, Nosferatu, Lon Chaney, and the first old dark houses.', genre: 'Horror', decades: [1910, 1920], count: 32 },
  { slug: 'seventies-horror', title: 'Seventies horror', blurb: 'Italian gialli, British folk horror and the American nightmares that started the slasher.', genre: 'Horror', decades: [1970, 1970], count: 32 },
  { slug: 'nineties-after-dark', title: '90s after dark', blurb: 'Horror, thrillers and science fiction from the rental-shop years, up to 2001.', genres: ['Horror', 'Thriller', 'Sci-Fi'], decades: [1990, 2000], count: 32 },
  { slug: 'song-and-dance', title: 'Song and dance', blurb: 'Musicals, big bands and the numbers people still hum.', genre: 'Music', decades: [1920, 1960], count: 32 },
  { slug: 'full-throttle', title: 'Full throttle', blurb: 'Action from any decade: fistfights, car chases and things blowing up.', genre: 'Action', decades: [1920, 1990], count: 32 },
  { slug: 'once-upon-a-time', title: 'Once upon a time', blurb: 'Fantasy and fairy tales: genies, wizards and stop-motion monsters.', genre: 'Fantasy', decades: [1920, 1990], count: 32 },
  { slug: 'epics-and-history', title: 'Epics and history', blurb: 'Kings, empires and the famous battles, on the biggest sets anyone could afford.', genre: 'History', decades: [1920, 1990], count: 32 },
  { slug: 'the-thirties', title: 'The 1930s', blurb: 'The first decade of sound, every kind of picture.', genres: EVERY_GENRE, decades: [1930, 1930], count: 32 },
  { slug: 'the-forties', title: 'The 1940s', blurb: 'Wartime and after, every kind of picture.', genres: EVERY_GENRE, decades: [1940, 1940], count: 32 },
  { slug: 'rental-comedy', title: 'Rental comedy', blurb: 'The 80s comedies that wore out the tape at the video store.', genre: 'Comedy', decades: [1980, 1980], count: 32, quality: { min: 6.0 } },
  { slug: 'cassette-futures', title: 'Cassette futures', blurb: '1980s science fiction on a VHS budget: mutants, machines and futures that went wrong.', genre: 'Sci-Fi', decades: [1980, 1980], count: 32, quality: { min: 6.0 } },
  { slug: 'late-fees', title: 'Late fees', blurb: '80s and 90s horror worth keeping out past the due date.', genre: 'Horror', decades: [1980, 1990], count: 32, quality: { min: 6.0 } },
  { slug: 'gothic-sixties', title: 'Gothic sixties', blurb: 'Horror from the 1960s: castles, curses, ghost stories from Japan and the first modern nightmares.', genre: 'Horror', decades: [1960, 1960], count: 32, quality: { min: 6.3 } },
  { slug: 'eighties-action-mixtape', title: '80s action mixtape', blurb: 'A decade of fists, fuel and one-liners, shuffled every week.', genre: 'Action', decades: [1980, 1980], count: 32, quality: { min: 6.0 } },
  { slug: 'after-hours', title: 'After hours', blurb: '80s and 90s thrillers: stakeouts, double-crosses and long nights, and no monsters.', genre: 'Thriller', not: ['Horror'], decades: [1980, 1990], count: 32, quality: { min: 6.0 } },
  { slug: 'golden-age', title: 'Golden age', blurb: 'The best-loved films of the 1930s and 40s, every kind, rated 7 or better.', genres: EVERY_GENRE, decades: [1930, 1940], count: 32, quality: { min: 7.0 } },
  { slug: 'swords-and-sorcery', title: 'Swords and sorcery', blurb: '80s fantasy: barbarians, wizards, rubber monsters and matte-painted kingdoms.', genre: 'Fantasy', decades: [1980, 1980], count: 32, quality: { min: 6.0 } },
  { slug: 'seventies-heat', title: 'Seventies heat', blurb: 'Crime from the 1970s: cops, con men, samurai assassins and the Paris underworld.', genre: 'Crime', decades: [1970, 1970], count: 32, quality: { min: 6.3 } },
  { slug: 'spies-and-capers', title: 'Spies and capers', blurb: 'Sixties thrillers and heists: kidnappings, double agents and one perfect plan.', genres: ['Thriller', 'Crime'], not: ['Horror'], decades: [1960, 1960], count: 32, quality: { min: 6.3 } },
  { slug: 'hidden-gems', title: 'Hidden gems', blurb: 'Films the few people who have seen them rate highly, and almost nobody else has heard of. Every genre, every decade, new picks every week.', genres: EVERY_GENRE, decades: [1910, 1990], count: 32, gems: true },
  { slug: 'family-matinee', title: 'Family matinee', blurb: 'Animation and family films the whole room can watch.', genre: 'Family', decades: [1920, 1990], count: 32 },
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
    // Cartoons only on a station that asks for Animation or Family (or every genre)
    if (e.g?.includes('Animation') && !wanted.some(g => CARTOON_GENRES.includes(g))) continue;
    if (!e.p || e.c < 0.8 || !e.g?.some(g => wanted.includes(g)) || !e.y || e.y < station.decades[0] || e.y >= station.decades[1] + 10) continue;
    // Feature length, decently rated, one upload per film, and allowed on air
    if (!(e.l >= 55) || (e.v || 0) < 5.5 || /trailer/i.test(id) || pool.has(e.i) || isTakenDown(id) || isRecent(e.y) || neverOnAir(e.i)) continue;
    // Hidden gems: known to some (20+ votes, so the rating means something), known to few (under 1,000), and well liked
    if (station.gems && !(e.k >= 20 && e.k < 1000 && e.v >= 6.5)) continue;
    // A quality bar: rated at least `min` by at least 20 people, so a channel is well-liked films
    // rather than whatever fits the genre
    if (station.quality && !(e.k >= 20 && e.v >= station.quality.min)) continue;
    if (station.not && e.g.some(g => station.not.includes(g))) continue;
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
