// Search suggestions. "Word matching" means every typed word must be the start of some word
// in the text, in any order: "haun hou" matches "House on Haunted Hill".
// Pure functions; the component decides where the data comes from.

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

// Newest first, no duplicates (case-insensitive), at most eight
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

export function rememberSearch(recent, query) {
  const text = String(query || '').trim();
  if (!text) return recent;
  return [text, ...recent.filter(r => r.toLowerCase() !== text.toLowerCase())].slice(0, 8);
}
