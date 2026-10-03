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
// Which profile the old browser-only list was copied into goes with it, and the channel it was
// copied into, so it is not copied twice
function keepPrevious(p) {
  try {
    const carried = localStorage.getItem(CARRIED_KEY) === p.id;
    const copy = carried && localStorage.getItem(COPY_KEY);
    localStorage.setItem(PREVIOUS_KEY, JSON.stringify({ id: p.id, key: p.key, carried, ...(copy && { copy }) }));
  } catch { /* private mode */ }
}

export function adoptFromLink(pathname, hash) {
  const id = pathname.match(/^\/u\/([a-z2-7]{10})\/?$/)?.[1];
  const found = keyFromHash(hash);
  if (!id || !found) return false;
  switchToProfile({ id, key: found.key });
  try { history.replaceState(null, '', pathname + (globalThis.location?.search || '')); } catch { /* not in a browser */ }
  return true;
}

// Make p this browser's profile, keeping a different one it had so the owner can switch back
export function switchToProfile(p) {
  const had = readProfile();
  if (had && had.id !== p.id) keepPrevious(had);
  writeProfile(p);
  keepStorage();
}

// Swap this browser's profile with the one kept by adoptFromLink. False when there is none.
export function switchBack() {
  const previous = readPrevious();
  const current = readProfile();
  if (!previous) return false;
  if (current) keepPrevious(current); else try { localStorage.removeItem(PREVIOUS_KEY); } catch { /* private mode */ }
  writeProfile(previous);
  if (previous.carried) { markCarried(previous); rememberCopy(ID.test(String(previous.copy)) ? previous.copy : null); }
  return true;
}

// A 401 on a call made with this browser's profile means its key was changed elsewhere (a
// passkey sign-in on another device); listeners show a notice. A key older than the stored one
// was replaced in this browser, so it needs no notice.
const staleListeners = new Set();
export function onStaleKey(fn) { staleListeners.add(fn); return () => staleListeners.delete(fn); }
export function noteStale(res, profile) {
  const stored = readProfile();
  if (res.status === 401 && profile && profile.id === stored?.id && profile.key === stored.key) staleListeners.forEach(fn => fn());
  return res;
}

export function api(path, { method = 'GET', body, profile } = {}) {
  return fetch(path, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(profile && { Authorization: `Bearer ${profile.id}.${profile.key}` }) },
    body: body && JSON.stringify(body),
  }).then(res => noteStale(res, profile));
}

// Copy the old browser-only list into a channel, once per profile. Never throws. The old list
// stays where it is (the TV page still reads it); a flag set only after the server accepts
// the channel stops a second copy, so a failure is retried on a later call.
const CARRIED_KEY = 'profile-carried';
let carriedMemory = null;
const carried = (p) => { try { if (localStorage.getItem(CARRIED_KEY) === p.id) return true; } catch { /* private mode */ } return carriedMemory === p.id; };
const markCarried = (p) => { carriedMemory = p.id; try { localStorage.setItem(CARRIED_KEY, p.id); } catch { /* private mode */ } };
// The profile the old list was copied into, if any
export const carriedInto = () => { try { const id = localStorage.getItem(CARRIED_KEY); if (id) return id; } catch { /* private mode */ } return carriedMemory; };
// The channel it was copied into, if known
const COPY_KEY = 'profile-carried-channel';
let copyMemory = null;
export const carriedChannel = () => { try { const id = localStorage.getItem(COPY_KEY); if (id) return id; } catch { /* private mode */ } return copyMemory; };
const rememberCopy = (id) => { copyMemory = id; try { if (id) localStorage.setItem(COPY_KEY, id); else localStorage.removeItem(COPY_KEY); } catch { /* private mode */ } };
let carrying = null;
function carryOver(p) {
  if (carried(p)) return Promise.resolve();
  const legacy = readMyChannel();
  if (!legacy.length) return Promise.resolve();
  carrying ||= (async () => {
    try {
      const res = await api('/api/channel', { method: 'POST', profile: p, body: { name: 'My channel', films: legacy.map(film => ({ film })) } });
      if (res.ok) {
        markCarried(p);
        const { id } = await res.json().catch(() => ({}));
        if (id) rememberCopy(id);
      }
    } catch { /* try again next time */ }
  })().finally(() => { carrying = null; });
  return carrying;
}

let creating = null;
// Asks the browser not to evict this site's storage, where the edit key lives
export function keepStorage(nav = globalThis.navigator) {
  try { return Promise.resolve(nav?.storage?.persist?.()).catch(() => false); } catch { return Promise.resolve(false); }
}

export async function ensureProfile() {
  const have = readProfile();
  if (have) { carryOver(have); return have; }
  creating ||= (async () => {
    const res = await api('/api/profile', { method: 'POST' });
    if (!res.ok) throw new Error(`Could not save (${res.status})`);
    const p = await res.json();
    writeProfile(p);
    keepStorage();
    await carryOver(p);
    return p;
  })().finally(() => { creating = null; });
  return creating;
}
