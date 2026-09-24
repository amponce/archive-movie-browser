#!/usr/bin/env node
// The best of Archive.org's film collections, judged by Jev: for each collection, the films in it
// the poster index has identified (src/services/collectionBest.js), and Jev's call on each one:
// a highlight of the collection, a film that belongs, or a stray. The site shows the result as
// the collection's "best of" shelf (public/collections.json); a collection not in the file falls
// back to the live ranking. About 40 decisions a collection, a fraction of a cent each.
//
//   node scripts/build-collections.mjs                      the most-downloaded film collections
//   node scripts/build-collections.mjs --only SciFi_Horror,vhsvault
//   node scripts/build-collections.mjs --collections 50     how many to walk (default 200)
//   node scripts/build-collections.mjs --genres-only        just the genres (browse's All Films)
// Genres are ranked too, as 'genre:Horror' ... and 'genre:all', for the shelf on All Films.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectionUploads, bestOfCollection, rankByJudgement, SURE_STRAY } from '../src/services/collectionBest.js';
import { cartoonOutOfPlace } from '../src/services/posterIndex.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/collections.json');
const MODEL = 'typesafe/jev-1.13';
const arg = name => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : null);
const flag = name => process.argv.includes(`--${name}`);

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
const KEY = readKey('OPEN_ROUTER_API_KEY', 'OPENROUTER_API_KEY');
if (!KEY) { console.error('Needs OPEN_ROUTER_API_KEY'); process.exit(1); }

const index = JSON.parse(fs.readFileSync(path.join(root, 'public/poster-index.json'), 'utf8')).films;
const SEARCH = 'https://archive.org/advancedsearch.php';

async function search(q, fields, rows, sort) {
  const params = new URLSearchParams({ q, rows: String(rows), output: 'json' });
  for (const f of fields) params.append('fl[]', f);
  if (sort) params.append('sort[]', sort);
  return (await (await fetch(`${SEARCH}?${params}`)).json()).response?.docs || [];
}

// The collections to walk: those named, or the most-downloaded collections inside Movies
async function collections() {
  const only = arg('only');
  const docs = only
    ? await search(`identifier:(${only.split(',').map(id => `"${id}"`).join(' OR ')})`, ['identifier', 'title', 'description'], 100)
    : await search('mediatype:collection AND collection:movies', ['identifier', 'title', 'description'], Number(arg('collections') || 200), 'downloads desc');
  return docs.map(d => ({ id: d.identifier, title: String(d.title || d.identifier), description: String([].concat(d.description || '')[0] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400) }));
}

let cost = 0;
async function judge(collection, e) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const answer = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        state: { collection: collection.title, collection_description: collection.description, film: `${e.t} (${e.y})`, genres: (e.g || []).join(', '), tmdb_rating: e.v, tmdb_votes: e.k },
        questions: { place: { type: 'choice', criteria: {
          highlight: 'A defining film of this collection: one of the first things someone opening it should watch',
          belongs: 'Fits what the collection is about, but is not one of its highlights',
          stray: 'Does not fit what this collection is about: a stray upload, or a recent studio film that happens to be in it',
        }, instructions: 'This is a film inside a collection on the Internet Archive. How central is it to what the collection is for?' } },
      }),
    }).catch(() => null);
    if (answer?.ok) {
      const data = await answer.json();
      cost += data.usage?.cost || 0;
      if (data.answers?.place) return { choice: data.answers.place.choice, confidence: Number(data.answers.place.confidence) || 0 };
    }
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return null; // not answered: the film keeps its place among those that belong
}

const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).collections || {} : {};
// A partial run (--only, --genres-only) keeps what the file already has for the rest
const out = arg('only') || flag('genres-only') ? { ...previous } : {};

// Jev's ranking of one set of uploads, or null when it holds fewer than six films we know
async function rank(collection, identifiers, total) {
  const { identified, films } = bestOfCollection(index, identifiers, { limit: 40 });
  if (films.length < 6) { console.log(`${collection.id}: ${films.length} films, skipped`); return null; }
  const verdicts = {};
  for (let i = 0; i < films.length; i += 6) {
    await Promise.all(films.slice(i, i + 6).map(async f => { const v = await judge(collection, f.entry); if (v) verdicts[f.id] = v; }));
  }
  const ranked = rankByJudgement(films, verdicts);
  const entry = {
    title: collection.title,
    total,
    identified,
    highlights: Object.values(verdicts).filter(v => v.choice === 'highlight').length,
    films: ranked.slice(0, 20).map(f => f.id),
    // Left out, with how sure Jev was, so a wrong call is easy to spot and correct
    strays: films.filter(f => verdicts[f.id]?.choice === 'stray' && verdicts[f.id].confidence >= SURE_STRAY).map(f => [f.id, Math.round(verdicts[f.id].confidence * 100) / 100]),
  };
  console.log(`${collection.id}: ${identified} of ${total} identified, ${entry.highlights} highlights, ${entry.strays.length} strays left out | ${ranked.slice(0, 5).map(f => f.entry.t).join('; ')}`);
  return entry;
}

if (!flag('genres-only')) {
  for (const collection of await collections()) {
    const { identifiers, total } = await collectionUploads(collection.id);
    const entry = await rank(collection, identifiers, total);
    if (entry) out[collection.id] = entry;
  }
}

// Browse's All Films: every genre the index knows, and all of them together ('genre:all'), ranked
// the same way, as if each were a collection of everything we have identified in it. Cartoons
// only count under Animation and Family, as in browse.
if (!arg('only')) {
  const genres = [...new Set(Object.values(index).flatMap(e => e.g || []))].sort();
  for (const genre of ['all', ...genres]) {
    const ids = Object.keys(index).filter(id => genre === 'all' || (index[id].g?.includes(genre) && !cartoonOutOfPlace(index[id].g, genre)));
    const title = genre === 'all' ? 'everything we have found' : genre;
    const description = genre === 'all'
      ? 'Every film on the Internet Archive that this site has identified: public domain classics, orphan works, cult films and whatever else uploaders kept.'
      : `${genre} films on the Internet Archive that this site has identified: public domain classics, orphan works and cult films.`;
    const entry = await rank({ id: `genre:${genre}`, title, description }, ids, ids.length);
    if (entry) out[`genre:${genre}`] = entry;
  }
}
fs.writeFileSync(OUT, `${JSON.stringify({ model: MODEL, builtAt: new Date().toISOString().slice(0, 10), collections: out })}\n`);
console.log(`\n${Object.keys(out).length} collections in public/collections.json, Jev cost $${cost.toFixed(4)}`);
