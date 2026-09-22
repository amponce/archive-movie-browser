// Spin the reel: a random film the index is sure about, opened in the player.
import { loadPosterIndex } from './posterIndex';
import { rowFor } from './programme';

export const watchUrl = id => `/browse#${encodeURIComponent(id)}`;

export async function spin() {
  const films = rowFor(await loadPosterIndex(), { limit: 600 });
  window.location.href = films.length ? watchUrl(films[Math.floor(Math.random() * films.length)].id) : '/browse';
}
