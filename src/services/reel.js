// Spin the reel: a random film the index is sure about, opened in the player.
// Used by the header on every page, so it loads the index itself.
import { rowFor } from './programme';

let pool = null;
async function load() {
  if (pool) return pool;
  const index = await fetch(`${import.meta.env?.BASE_URL || '/'}poster-index.json`).then(r => (r.ok ? r.json() : { films: {} })).catch(() => ({ films: {} }));
  pool = rowFor(index.films || {}, { limit: 600 });
  return pool;
}

export const watchUrl = id => `/browse#${encodeURIComponent(id)}`;

export async function spin() {
  const films = await load();
  if (!films.length) { window.location.href = '/browse'; return; }
  window.location.href = watchUrl(films[Math.floor(Math.random() * films.length)].id);
}
