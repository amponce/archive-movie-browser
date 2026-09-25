// Search suggestions. "Word matching" means every typed word must be the start of some word
// in the text, in any order: "haun hou" matches "House on Haunted Hill".
// Pure functions; the component decides where the data comes from.

import { isRecent } from './policy.js';

const WORD = /[\p{L}\p{N}]+/gu;
const words = text => String(text || '').toLowerCase().match(WORD) || [];

// Ranges [start, end) to highlight in `text`, or null when some typed word matches nothing.
export function matchRanges(text, query) {
  const typed = words(query);
  if (!typed.length) return null;

  const source = String(text);
  const found = [...source.matchAll(WORD)].map(m => ({ word: m[0].toLowerCase(), start: m.index }));
  const longest = new Map(); // start -> end, keeping the longest highlight per word
  for (const prefix of typed) {
    const hits = found.filter(w => w.word.startsWith(prefix));
    if (!hits.length) return null;
    for (const hit of hits) longest.set(hit.start, Math.max(longest.get(hit.start) || 0, hit.start + prefix.length));
  }
  return [...longest.entries()].sort((a, b) => a[0] - b[0]);
}

// Instant suggestions from what the browser already has. An empty box offers recent searches.
export function localSuggestions(query, { genres = [], collections = [], movies = [], recent = [] }, limit = 6) {
  if (!words(query).length) return recent.slice(0, limit).map(label => ({ type: 'recent', label, ranges: [] }));

  const out = [];
  const add = (type, label, extra) => {
    const ranges = matchRanges(label, query);
    if (ranges && !out.some(s => s.type === type && s.label.toLowerCase() === label.toLowerCase())) out.push({ type, label, ranges, ...extra });
  };
  genres.forEach(genre => add('genre', genre, { genre }));
  collections.forEach(collection => add('collection', collection.name, { collectionId: collection.id }));
  recent.forEach(label => add('recent', label));

  // A title that starts with what was typed beats one that merely contains it
  const first = words(query)[0];
  const films = movies
    .filter(movie => matchRanges(movie.title, query))
    .sort((a, b) => Number(words(b.title)[0]?.startsWith(first)) - Number(words(a.title)[0]?.startsWith(first)));
  films.forEach(movie => add('film', movie.title, { movie }));
  return out.slice(0, limit);
}

// Films the poster index has identified, matched by the film's real title rather than the
// upload's ("Zombie Holocaust" finds an upload named "Zombi Holocaust 1980"). `index` is the
// identifier -> entry map. Returns { identifier, title, year } per hit, best first.
export function indexSuggestions(query, index, limit = 6) {
  const typed = words(query);
  if (!typed.length || !index) return [];
  const first = typed[0];
  const hits = [];
  for (const identifier in index) {
    const entry = index[identifier];
    if (!entry.t || !entry.p) continue;
    // Match the English title or the original one; show whichever matched
    const ranges = matchRanges(entry.t, query);
    if (ranges) { hits.push({ identifier, title: entry.t, year: entry.y, ranges, rating: entry.v || 0 }); continue; }
    const original = entry.o && matchRanges(entry.o, query);
    if (original) hits.push({ identifier, title: `${entry.o} (${entry.t})`, year: entry.y, ranges: original, rating: entry.v || 0 });
  }
  return hits
    .sort((a, b) => Number(words(b.title)[0]?.startsWith(first)) - Number(words(a.title)[0]?.startsWith(first)) || b.rating - a.rating)
    .slice(0, limit);
}

// Letters and digits only, no spaces or accents: "Sleep Away Camp" and "Sleepaway Camp" compare equal
const compact = text => String(text || '').toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');

// Edits between two strings (a swapped pair of letters is one), or limit + 1 once it is clearly more
function edits(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before = null;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
      best = Math.min(best, row[j]);
    }
    if (best > limit) return limit + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length];
}

// Films the index knows whose real title is what was typed, give or take spaces and a typo or two:
// "sleep away camp" is Sleepaway Camp, "nosferato" is Nosferatu. For the type-ahead when word
// matching finds nothing, and for "Did you mean" when a search does. Best first, one per title.
export function closeTitles(query, index, limit = 3) {
  const typed = compact(query);
  if (typed.length < 4 || !index) return [];
  const allowed = typed.length >= 9 ? 2 : 1;
  const best = new Map(); // title -> hit
  for (const identifier in index) {
    const entry = index[identifier];
    if (!entry.t || !entry.p || isRecent(entry.y)) continue; // the site suggests nothing from the last 25 years
    const title = compact(entry.t);
    // The whole title, or (for longer searches) the start of it: "nosferatu eine" is Nosferatu, eine Symphonie...
    let distance = edits(typed, title, allowed);
    let whole = true;
    if (distance > allowed && typed.length >= 6 && title.length > typed.length) { distance = edits(typed, title.slice(0, typed.length), allowed); whole = false; }
    if (distance > allowed) continue;
    const hit = { identifier, title: entry.t, year: entry.y, distance, whole, rating: entry.v || 0 };
    const seen = best.get(entry.t);
    if (!seen || hit.distance < seen.distance || (hit.distance === seen.distance && hit.rating > seen.rating)) best.set(entry.t, hit);
  }
  // Fewest edits first, then a whole title before one that only starts that way, then the better rated
  return [...best.values()].sort((a, b) => a.distance - b.distance || Number(b.whole) - Number(a.whole) || b.rating - a.rating).slice(0, limit);
}

// Tags uploaders have put on the films in a search response, for the type-ahead. Counted from
// that sample, so the order is a good guess rather than a census.
export function suggestTags(movies, query, { exclude = [], limit = 4 } = {}) {
  const skip = new Set(exclude.map(name => name.toLowerCase()));
  const found = new Map(); // "zombie" -> { label, count }: singular and plural are one tag
  for (const movie of movies) {
    for (const tag of new Set((movie.tags || []).map(t => t.toLowerCase()))) {
      if (tag.length > 40 || skip.has(tag) || !matchRanges(tag, query)) continue;
      const key = tag.replace(/s$/, '');
      const entry = found.get(key) || { label: tag, count: 0, uses: {} };
      entry.count++;
      entry.uses[tag] = (entry.uses[tag] || 0) + 1;
      if (entry.uses[tag] > (entry.uses[entry.label] || 0) || (entry.uses[tag] === entry.uses[entry.label] && tag.length > entry.label.length)) entry.label = tag;
      found.set(key, entry);
    }
  }
  return [...found.values()]
    .filter(entry => entry.count >= 2) // used once is usually a sentence or a typo
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ label, count }) => ({ label, count, ranges: matchRanges(label, query) }));
}

// Newest first, no duplicates (case-insensitive), at most eight
export function rememberSearch(recent, query) {
  const text = String(query || '').trim();
  if (!text) return recent;
  return [text, ...recent.filter(r => r.toLowerCase() !== text.toLowerCase())].slice(0, 8);
}
