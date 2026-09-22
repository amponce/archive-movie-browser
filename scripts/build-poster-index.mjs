#!/usr/bin/env node
// Builds public/poster-index.json: for the most-downloaded uploads in each film collection,
// decide offline which TMDB film the upload is (or that it is none), so the app can show real
// posters without a TMDB key and without matching titles in every visitor's browser.
//
//   npm run index                       150 uploads per film collection, resumes the existing file
//   npm run index -- --limit 500        more per collection
//   npm run index -- --collections Film_Noir,silent_films
//   npm run index -- --fresh            ignore the existing file and decide everything again
//   npm run index -- --views             also the top uploads of every genre pill and every decade
//   npm run index -- --views --limit 300 (what the app actually shows: the index should follow it)
//
// Keys come from the environment, or from .env.local / .env / ../.env (never from the bundle):
//   TMDB_API_KEY (or VITE_TMDB_API_KEY)   candidate films
//   OPEN_ROUTER_API_KEY                   the decision model (typesafe/jev-1.13 via OpenRouter)
//
// A decision is permanent per Archive.org identifier, so re-running only pays for new uploads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { archiveService, VIDEO_CATEGORIES, STANDARD_GENRES, DECADES, ALL_FILMS } = await import(path.join(root, 'src/services/archive.js'));
const { candidateQueries } = await import(path.join(root, 'src/services/movieMatching.js'));
const { decisionToEntry, CONFIDENCE_THRESHOLD } = await import(path.join(root, 'src/services/posterIndex.js'));

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(a => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const LIMIT = Number(args.limit) || 150;
const OUT = path.resolve(root, args.out || 'public/poster-index.json');
const MODEL = 'typesafe/jev-1.13';
const collections = args.collections ? String(args.collections).split(',') : VIDEO_CATEGORIES.filter(c => c.films).map(c => c.id);

// What to walk: each collection on its own, and with --views every genre pill and every decade
// across All Films, since those are the lists visitors see first. Each walk takes its top LIMIT.
const walks = collections.map(collection => ({ name: collection, options: { collection } }));
if (args.views) {
  for (const genre of STANDARD_GENRES) walks.push({ name: `genre ${genre}`, options: { collection: ALL_FILMS, genre } });
  for (const decade of DECADES) walks.push({ name: `${decade}s`, options: { collection: ALL_FILMS, decade } });
}

function readKey(...names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  for (const file of ['.env.local', '.env', '../.env']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && names.includes(match[1])) return match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}
const TMDB_KEY = readKey('TMDB_API_KEY', 'VITE_TMDB_API_KEY');
const OPENROUTER_KEY = readKey('OPEN_ROUTER_API_KEY', 'OPENROUTER_API_KEY');
if (!TMDB_KEY || !OPENROUTER_KEY) {
  console.error('Missing keys. Set TMDB_API_KEY and OPEN_ROUTER_API_KEY in the environment or in .env.local (see the header of this file).');
  process.exit(1);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const label = film => `${film.title} (${(film.release_date || '').slice(0, 4) || 'year unknown'})`;

async function getJson(url, options, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      if (response.status < 500 && response.status !== 429) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
    } catch (error) {
      if (attempt >= attempts) throw error;
    }
    if (attempt >= attempts) throw new Error(`gave up after ${attempts} attempts: ${url.split('?')[0]}`);
    await sleep(1000 * attempt);
  }
}

// Every TMDB film any of the queries returns, so the right one is among the options
async function candidatesFor(title) {
  const found = new Map();
  for (const query of candidateQueries(title)) {
    const data = await getJson(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&include_adult=false&query=${encodeURIComponent(query)}`);
    for (const film of (data.results || []).slice(0, 6)) if (found.size < 20 && !found.has(film.id)) found.set(film.id, film);
    await sleep(30);
  }
  return [...found.values()];
}

const totals = { cost: 0, tokens: 0, decided: 0 };
async function decide(movie) {
  const candidates = await candidatesFor(movie.title);
  if (!candidates.length) return { n: 1, c: 1 }; // TMDB knows nothing like it
  const criteria = Object.fromEntries(candidates.map((film, i) => [`c${i + 1}`, `${label(film)}. ${(film.overview || '').slice(0, 110)}`]));
  criteria.none = 'None of these: a different film, a game recording, a music video, a fan edit of something else, or not a film at all';
  const data = await getJson('https://openrouter.ai/api/alpha/decisions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: {
        upload_title: movie.title,
        year_field: movie.year,
        runtime_minutes: Math.round(movie.runtimeMinutes) || null,
        uploader: movie.creator || null,
        description: String(movie.description || '').replace(/<[^>]+>/g, ' ').slice(0, 300),
      },
      questions: {
        which_film: {
          type: 'choice',
          criteria,
          instructions: 'This is an upload on Archive.org. Which film should its poster show? Uploads hosted by a TV horror host, with commentary, colorized, dubbed or subtitled are still that film. A trailer is still that film. Pick none if no candidate is the film.',
        },
      },
    }),
  });
  const answer = data.answers.which_film;
  totals.cost += data.usage?.cost || 0;
  totals.tokens += data.usage?.input_tokens || 0;
  totals.decided++;
  const film = answer.choice === 'none' ? null : candidates[Number(answer.choice.slice(1)) - 1];
  return decisionToEntry({ film, confidence: answer.confidence });
}

// Entries corrected by hand (m: 1) are kept even with --fresh
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).films || {} : {};
const existing = args.fresh ? Object.fromEntries(Object.entries(previous).filter(([, entry]) => entry.m)) : previous;
const films = { ...existing };
console.log(`Poster index: up to ${LIMIT} uploads from each of ${walks.length} walks; ${Object.keys(existing).length} already decided.`);

for (const { name, options } of walks) {
  const uploads = [];
  for (let page = 1; uploads.length < LIMIT; page++) {
    const { movies, total } = await archiveService.fetchMovies({ ...options, page, rowsPerPage: 100 });
    uploads.push(...movies);
    if (!movies.length || page * 100 >= total) break;
  }
  const todo = uploads.slice(0, LIMIT).filter(movie => !films[movie.identifier]);
  console.log(`\n${name}: ${todo.length} new of ${Math.min(uploads.length, LIMIT)}`);

  // Three at a time: polite to both APIs and still a few hundred uploads per minute
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.all(todo.slice(i, i + 3).map(async movie => {
      try {
        films[movie.identifier] = await decide(movie);
      } catch (error) {
        console.warn(`  skipped ${movie.identifier}: ${error.message}`); // left undecided; the app matches it live
      }
    }));
    if ((i / 3) % 10 === 9) process.stdout.write(`  ${Math.min(i + 3, todo.length)}/${todo.length}\r`);
  }
  // Save after every collection so an interrupted run loses little
  const sorted = Object.fromEntries(Object.keys(films).sort().map(id => [id, films[id]]));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ version: 1, model: MODEL, threshold: CONFIDENCE_THRESHOLD, generatedAt: new Date().toISOString().slice(0, 10), films: sorted }) + '\n');
}

const entries = Object.values(films);
const withPoster = entries.filter(entry => !entry.n).length;
console.log(`\nDone. ${entries.length} uploads indexed: ${withPoster} with a poster (${Math.round(100 * withPoster / entries.length)}%), ${entries.length - withPoster} generated cover.`);
console.log(`This run: ${totals.decided} decisions, ${totals.tokens.toLocaleString()} input tokens, $${totals.cost.toFixed(4)}. File: ${path.relative(root, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
