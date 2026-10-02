import { readMyChannel, MY_CHANNEL_KEY } from './myChannel.js';

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

export function adoptFromLink(pathname, hash) {
  const id = pathname.match(/^\/u\/([a-z2-7]{10})$/)?.[1];
  const found = keyFromHash(hash);
  if (!id || !found) return false;
  writeProfile({ id, key: found.key });
  try { history.replaceState(null, '', pathname + (globalThis.location?.search || '')); } catch { /* not in a browser */ }
  return true;
}

export function api(path, { method = 'GET', body, profile } = {}) {
  return fetch(path, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(profile && { Authorization: `Bearer ${profile.id}.${profile.key}` }) },
    body: body && JSON.stringify(body),
  });
}

// Move the old browser-only list into a channel. Never throws; the old list is removed only
// once the server has accepted it, so a failure is retried on a later call.
let carrying = null;
function carryOver(p) {
  const legacy = readMyChannel();
  if (!legacy.length) return Promise.resolve();
  carrying ||= (async () => {
    try {
      const res = await api('/api/channel', { method: 'POST', profile: p, body: { name: 'My channel', films: legacy.map(film => ({ film })) } });
      if (res.ok) localStorage.removeItem(MY_CHANNEL_KEY);
    } catch { /* keep the list, try again next time */ }
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
