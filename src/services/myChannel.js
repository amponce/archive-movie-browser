// A channel of your own: a list of Archive.org identifiers kept in this browser, and carried in
// a link (`/tv?mine=a,b,c`) so anyone who opens it gets the same channel on the same clock.
// No account, no server. Pure functions plus two storage helpers.

export const MY_CHANNEL_KEY = 'tv-my-channel';
export const MY_CHANNEL_ID = 'mine';
const MAX = 40;

const clean = ids => [...new Set((ids || []).map(id => String(id).trim()).filter(id => /^[\w.-]+$/.test(id)))].slice(0, MAX);

export function readMyChannel() {
  try { return clean(JSON.parse(localStorage.getItem(MY_CHANNEL_KEY) || '[]')); } catch { return []; }
}
export function writeMyChannel(ids) {
  try { localStorage.setItem(MY_CHANNEL_KEY, JSON.stringify(clean(ids))); } catch { /* private mode */ }
}

export const hasFilm = (ids, id) => ids.includes(id);
export const toggleFilm = (ids, id) => (hasFilm(ids, id) ? ids.filter(x => x !== id) : clean([...ids, id]));

// The lineup a link carries, if any
export function channelFromUrl(search) {
  const ids = new URLSearchParams(search).get('mine');
  return ids ? clean(ids.split(',')) : null;
}
export const shareUrl = (ids, origin = '') => `${origin}/tv?mine=${clean(ids).map(encodeURIComponent).join(',')}`;
