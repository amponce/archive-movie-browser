// The best films in an Archive.org collection: its uploads that the poster index has identified,
// one per film, ranked by how many people have rated them on TMDB. A collection is someone's
// taste; this is what it holds that we can put a name and a poster to. Follows the rules for
// what the site shows on its own (src/services/policy.js): no recent film, nothing taken down.
import { betterUpload, isFeature } from './indexBrowse.js';
import { isRecent, isTakenDown } from './policy.js';

const SCRAPE = 'https://archive.org/services/search/v1/scrape';

// The collection's most-downloaded uploads, up to 10,000 in one request (where its best films
// are), and how many it holds in all.
// ponytail: past 10,000 uploads (The VHS Vault has 118,000) the rest is not looked at; page with
// the returned cursor if the best films start turning up further down.
export async function collectionUploads(id) {
  const params = new URLSearchParams({ q: `collection:"${id}" AND mediatype:movies`, fields: 'identifier', sorts: 'downloads desc', count: '10000' });
  const answer = await (await fetch(`${SCRAPE}?${params}`)).json();
  return { identifiers: (answer.items || []).map(item => item.identifier), total: answer.total || 0 };
}

// An upload the site may show as a film of the collection
export const showable = (id, e, now = new Date()) => !!e?.i && !!e.p && e.c >= 0.8 && isFeature([id, e]) && !isRecent(e.y, now) && !isTakenDown(id);

// identifiers -> { identified: films we know in it, films: the best of them, best first }
export function bestOfCollection(index, identifiers, { limit = 20, now = new Date() } = {}) {
  const films = new Map();
  for (const id of identifiers) {
    const e = index[id];
    if (!showable(id, e, now)) continue;
    const kept = films.get(e.i);
    if (!kept || betterUpload([id, e], kept) < 0) films.set(e.i, [id, e]);
  }
  const ranked = [...films.values()].filter(([, e]) => (e.v || 0) >= 6).sort((a, b) => (b[1].k || 0) - (a[1].k || 0));
  return { identified: films.size, films: ranked.slice(0, limit).map(([id, entry]) => ({ id, entry })) };
}

// Jev's judgement of each film's place in the collection (scripts/build-collections.mjs):
// verdicts[id] = { choice: 'highlight' | 'belongs' | 'stray', confidence }. Highlights lead, most
// certain first; the rest keep the best-known-first order, since Jev is seldom sure between them.
// A stray is left out only when Jev is sure (It Happened One Night in Film Noir, 0.99); below that
// it is a neighbour of the collection (Breathless, The Long Goodbye) and stays with the rest.
export const SURE_STRAY = 0.8;
export function rankByJudgement(films, verdicts) {
  const verdict = f => verdicts[f.id] || { choice: 'belongs', confidence: 0 };
  const highlights = films.filter(f => verdict(f).choice === 'highlight').sort((a, b) => verdict(b).confidence - verdict(a).confidence);
  const rest = films.filter(f => verdict(f).choice === 'belongs' || (verdict(f).choice === 'stray' && verdict(f).confidence < SURE_STRAY));
  return [...highlights, ...rest];
}

// The rankings Jev made offline (public/collections.json), loaded once and only on a collection's page
let ranked = null;
export function loadRankedCollections() {
  ranked ||= fetch('/collections.json').then(r => (r.ok ? r.json() : {})).then(d => d.collections || {}).catch(() => ({}));
  return ranked;
}
