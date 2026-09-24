#!/usr/bin/env node
// Adds what Archive.org's visitors say to every upload of a film the index has more than one
// upload of, so the one people chose plays (betterUpload in src/services/indexBrowse.js):
// `f`, how many people favourited the upload, and `bad: 1` when several reviewers panned it.
// Only those uploads need it; a film with one upload has nothing to choose between. Rerun it
// whenever the index grows: about 80 requests.
//
//   node scripts/backfill-favourites.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { panned, identifierQueries } from '../src/services/archive.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/poster-index.json');
const index = JSON.parse(fs.readFileSync(OUT, 'utf8'));

const uploads = new Map();
for (const [id, e] of Object.entries(index.films)) if (e.i) uploads.set(e.i, [...(uploads.get(e.i) || []), id]);
const ids = [...uploads.values()].filter(copies => copies.length > 1).flat();

let marked = 0;
for (const { ids: batch, q } of identifierQueries(ids)) {
  const params = new URLSearchParams({ q, rows: String(batch.length), output: 'json' });
  for (const field of ['identifier', 'num_favorites', 'num_reviews', 'avg_rating']) params.append('fl[]', field);
  const docs = (await (await fetch(`https://archive.org/advancedsearch.php?${params}`)).json()).response?.docs || [];
  const byId = new Map(docs.map(doc => [doc.identifier, doc]));
  for (const id of batch) {
    const doc = byId.get(id);
    if (!doc) continue; // not answered this time: keep what it had
    const e = index.films[id];
    delete e.f; delete e.bad;
    if (doc.num_favorites > 0) e.f = doc.num_favorites;
    if (panned({ reviews: doc.num_reviews, rating: doc.avg_rating })) e.bad = 1;
    marked++;
  }
  process.stdout.write(`\r${marked} of ${ids.length}`);
}
fs.writeFileSync(OUT, JSON.stringify(index));
console.log(`\n${marked} uploads of ${new Set(ids.map(id => index.films[id].i)).size} films`);
