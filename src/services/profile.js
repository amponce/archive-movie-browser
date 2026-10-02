import { readMyChannel } from './myChannel.js';

export const PROFILE_KEY = 'profile';
const KEY = /^[0-9a-f]{64}$/;
const ID = /^[a-z2-7]{10}$/;

// Held in memory when storage is unavailable (private mode), so one page makes one profile
let memory = null;

export function readProfile() {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); if (p && ID.test(p.id) && KEY.test(p.key)) return p; } catch { /* fall through */ }
  return memory;
}
export function writeProfile(p) {
  memory = { id: p.id, key: p.key };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(memory)); } catch { /* private mode */ }
}
export function keyFromHash(hash) { const key = new URLSearchParams(String(hash).replace(/^#/, '')).get('key'); return key && KEY.test(key) ? { key } : null; }
export const editLink = (origin, p) => `${origin}/u/${p.id}#key=${p.key}`;

// A different profile this browser had is kept under PREVIOUS_KEY, so the owner can switch back
export const PREVIOUS_KEY = 'profile-previous';
export function readPrevious() {
  try { const p = JSON.parse(localStorage.getItem(PREVIOUS_KEY) || 'null'); if (p && ID.test(p.id) && KEY.test(p.key)) return p; } catch { /* fall through */ }
  return null;
}
// Which profile the old browser-only list was copied into goes with it, so it is not copied twice
function keepPrevious(p) {
  try { localStorage.setItem(PREVIOUS_KEY, JSON.stringify({ id: p.id, key: p.key, carried: localStorage.getItem(CARRIED_KEY) === p.id })); } catch { /* private mode */ }
}

export function adoptFromLink(pathname, hash) {
  const id = pathname.match(/^\/u\/([a-z2-7]{10})\/?$/)?.[1];
  const found = keyFromHash(hash);
  if (!id || !found) return false;
  const had = readProfile();
  if (had && had.id !== id) keepPrevious(had);
  writeProfile({ id, key: found.key });
  try { history.replaceState(null, '', pathname + (globalThis.location?.search || '')); } catch { /* not in a browser */ }
  return true;
}

// Swap this browser's profile with the one kept by adoptFromLink. False when there is none.
export function switchBack() {
  const previous = readPrevious();
  const current = readProfile();
  if (!previous) return false;
  if (current) keepPrevious(current); else try { localStorage.removeItem(PREVIOUS_KEY); } catch { /* private mode */ }
  writeProfile(previous);
  if (previous.carried) markCarried(previous);
  return true;
}

export function api(path, { method = 'GET', body, profile } = {}) {
  return fetch(path, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(profile && { Authorization: `Bearer ${profile.id}.${profile.key}` }) },
    body: body && JSON.stringify(body),
  });
}

// Copy the old browser-only list into a channel, once per profile. Never throws. The old list
// stays where it is (the TV page still reads it); a flag set only after the server accepts
// the channel stops a second copy, so a failure is retried on a later call.
const CARRIED_KEY = 'profile-carried';
let carriedMemory = null;
const carried = (p) => { try { if (localStorage.getItem(CARRIED_KEY) === p.id) return true; } catch { /* private mode */ } return carriedMemory === p.id; };
const markCarried = (p) => { carriedMemory = p.id; try { localStorage.setItem(CARRIED_KEY, p.id); } catch { /* private mode */ } };
let carrying = null;
function carryOver(p) {
  if (carried(p)) return Promise.resolve();
  const legacy = readMyChannel();
  if (!legacy.length) return Promise.resolve();
  carrying ||= (async () => {
    try {
      const res = await api('/api/channel', { method: 'POST', profile: p, body: { name: 'My channel', films: legacy.map(film => ({ film })) } });
      if (res.ok) markCarried(p);
    } catch { /* try again next time */ }
  })().finally(() => { carrying = null; });
  return carrying;
}

let creating = null;
export async function ensureProfile() {
  const have = readProfile();
  if (have) { carryOver(have); return have; }
  creating ||= (async () => {
    const res = await api('/api/profile', { method: 'POST' });
    if (!res.ok) throw new Error(`Could not save (${res.status})`);
    const p = await res.json();
    writeProfile(p);
    await carryOver(p);
    return p;
  })().finally(() => { creating = null; });
  return creating;
}
