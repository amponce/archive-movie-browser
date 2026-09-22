// The landing page as a programme: what to feature and which films fill each row, decided
// from the poster index alone so the page needs no request before someone opens a film.
// Index entries may carry g (genres) and u (upload title) when the build stores them.

const usable = ([id, entry]) => entry.i && entry.p && entry.c >= 0.8;
const film = ([id, entry]) => ({ id, entry });

function seededShuffle(items, seed) {
  let s = seed >>> 0 || 1;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Tonight's film: confident, with a poster, rated 7 or better, and the same for everyone all day
export function featuredFor(index, now = new Date()) {
  const candidates = Object.entries(index).filter(usable).filter(([, e]) => (e.v || 0) >= 7).map(film);
  if (!candidates.length) return null;
  const day = Math.floor(now.getTime() / 86400000);
  return seededShuffle(candidates, day)[0];
}

// A row: films of a genre (and decade) the index knows well, best rated first
export function rowFor(index, { genre, decade, limit = 12 } = {}) {
  return Object.entries(index)
    .filter(usable)
    .filter(([, e]) => (!genre || (e.g || []).includes(genre)) && (!decade || (e.y >= decade && e.y < decade + 10)))
    .sort((a, b) => (b[1].v || 0) - (a[1].v || 0))
    .slice(0, limit)
    .map(film);
}

// Films whose upload name is not the film's name: the index earned these
export function revealsFrom(index, limit = 12) {
  return Object.entries(index)
    .filter(usable)
    .filter(([, e]) => e.u && !e.u.toLowerCase().includes(e.t.toLowerCase()))
    .slice(0, limit)
    .map(film);
}
