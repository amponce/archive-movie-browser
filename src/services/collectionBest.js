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

// identifiers -> { identified: films we know in it, films: the best of them, best first }
export function bestOfCollection(index, identifiers, { limit = 20, now = new Date() } = {}) {
  const films = new Map();
  for (const id of identifiers) {
    const e = index[id];
    if (!e?.i || !e.p || e.c < 0.8 || !isFeature([id, e]) || isRecent(e.y, now) || isTakenDown(id)) continue;
    const kept = films.get(e.i);
    if (!kept || betterUpload([id, e], kept) < 0) films.set(e.i, [id, e]);
  }
  const ranked = [...films.values()].filter(([, e]) => (e.v || 0) >= 6).sort((a, b) => (b[1].k || 0) - (a[1].k || 0));
  return { identified: films.size, films: ranked.slice(0, limit).map(([id, entry]) => ({ id, entry })) };
}
