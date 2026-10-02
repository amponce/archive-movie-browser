// Profiles, favourites and channels: rules and storage. `db` is a D1 database.
import { isTakenDown } from '../src/services/policy.js';

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
export const LIMITS = { displayName: 40, name: 80, description: 500, note: 280, films: 40, channels: 50, favourites: 1000, minToSubmit: 5 };
export const FILM = /^[A-Za-z0-9._-]{1,200}$/;
export const ID = /^[a-z2-7]{10}$/;

const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
export const newId = () => [...crypto.getRandomValues(new Uint8Array(10))].map(b => ALPHABET[b & 31]).join('');
export const newKey = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hashKey = async key => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(key)))));

// eslint-disable-next-line no-control-regex
export const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function cleanFilms(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const film = String(item?.film ?? '');
    if (!FILM.test(film) || isTakenDown(film) || seen.has(film)) continue;
    seen.add(film);
    out.push({ film, note: cleanText(item.note, LIMITS.note) });
    if (out.length === LIMITS.films) break;
  }
  return out;
}

export const isListed = status => status === 'public' || status === 'featured';
export const afterContentEdit = status => (isListed(status) ? 'submitted' : status);
export function submitProblem({ films, flagged, status }) {
  if (status === 'hidden') return 'hidden';
  if (films < LIMITS.minToSubmit) return 'too-few';
  if (flagged > 0) return 'flagged';
  return null;
}
