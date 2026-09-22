// Linear television from a playlist. A channel is a lineup of films with known lengths, played
// in order, round and round, from a fixed moment in time. Given the clock, everyone gets the
// same film at the same minute, on the site or in another player reading our guide.
// Pure functions: the clock is always passed in.

export const EPOCH = Date.UTC(2026, 8, 21); // when every channel started its first film
const BETWEEN_FILMS = 30; // seconds of black between films, so a schedule has whole-ish edges

// lineup: [{ id, title, seconds, ... }]. Films with no length cannot be scheduled and are left out.
export function airable(lineup) {
  return lineup.filter(film => Number(film.seconds) > 0);
}

const slotLength = film => Math.round(film.seconds) + BETWEEN_FILMS;
const cycleLength = lineup => lineup.reduce((sum, film) => sum + slotLength(film), 0);

// What a channel is showing at `now`: the film, how far into it we are, and when it started
// and ends. Null when nothing can air.
export function onAirAt(lineup, now = Date.now(), epoch = EPOCH) {
  const films = airable(lineup);
  if (!films.length) return null;
  const cycle = cycleLength(films);
  const elapsed = ((now - epoch) / 1000) % cycle;
  const position = elapsed < 0 ? elapsed + cycle : elapsed;

  let start = 0;
  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    const end = start + slotLength(film);
    if (position < end) {
      const offset = Math.min(Math.floor(position - start), Math.round(film.seconds));
      const startedAt = now - Math.floor(position - start) * 1000;
      return { film, index: i, offset, startedAt, endsAt: startedAt + slotLength(film) * 1000 };
    }
    start = end;
  }
  return null; // unreachable: position is always inside the cycle
}

// The programmes on a channel from `from` until `to`, in order, for a guide
export function programmesBetween(lineup, from, to, epoch = EPOCH) {
  const films = airable(lineup);
  if (!films.length) return [];
  const out = [];
  let slot = onAirAt(films, from, epoch);
  while (slot && slot.startedAt < to) {
    out.push({ film: slot.film, startsAt: slot.startedAt, endsAt: slot.endsAt });
    const next = films[(slot.index + 1) % films.length];
    const startedAt = slot.endsAt;
    slot = { film: next, index: (slot.index + 1) % films.length, startedAt, endsAt: startedAt + slotLength(next) * 1000 };
  }
  return out;
}

// Where to start playback when someone tunes in: the live offset, except in the first minute
// (start clean) and the last two (nothing left to watch, show the next film instead)
export function tuneIn(slot) {
  if (!slot) return null;
  const total = Math.round(slot.film.seconds);
  if (slot.offset < 60) return { film: slot.film, offset: 0 };
  if (slot.offset > total - 120) return null;
  return { film: slot.film, offset: slot.offset };
}
