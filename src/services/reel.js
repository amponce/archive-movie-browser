// Spin the reel: a random film the index is sure about, opened in the player.
import { loadPosterIndex } from './posterIndex';
import { rowFor } from './programme';

export const watchUrl = id => `/browse#${encodeURIComponent(id)}`;

// A play button elsewhere (the front page's film of the day) opens the film playing, not just its
// page. The wish rides in this tab's session for a few seconds, so a shared link still opens on
// the page. It is not deleted on reading, because React may mount the page twice while opening it.
// Browsers may still hold back sound until a click on the film page itself.
const ARRIVAL = 'play-on-arrival';
export function playOnArrival(id) {
  try { sessionStorage.setItem(ARRIVAL, JSON.stringify({ id, at: Date.now() })); } catch { /* storage off: it opens on the page */ }
}
export function takePlayOnArrival(id, now = Date.now()) {
  try {
    const wish = JSON.parse(sessionStorage.getItem(ARRIVAL) || 'null');
    return wish?.id === id && now - wish.at < 15000;
  } catch { return false; }
}

export async function spin() {
  const films = rowFor(await loadPosterIndex(), { limit: 600 });
  window.location.href = films.length ? watchUrl(films[Math.floor(Math.random() * films.length)].id) : '/browse';
}
