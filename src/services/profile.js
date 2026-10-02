import { readMyChannel, MY_CHANNEL_KEY } from './myChannel.js';

export const PROFILE_KEY = 'profile';
const KEY = /^[0-9a-f]{64}$/;
const ID = /^[a-z2-7]{10}$/;

export function readProfile() {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); return p && ID.test(p.id) && KEY.test(p.key) ? p : null; } catch { return null; }
}
export function writeProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ id: p.id, key: p.key })); } catch { /* private mode */ } }
export function keyFromHash(hash) { const key = new URLSearchParams(String(hash).replace(/^#/, '')).get('key'); return key && KEY.test(key) ? { key } : null; }
export const editLink = (origin, p) => `${origin}/u/${p.id}#key=${p.key}`;

export function adoptFromLink(pathname, hash) {
  const id = pathname.match(/^\/u\/([a-z2-7]{10})$/)?.[1];
  const found = keyFromHash(hash);
  if (!id || !found) return false;
  writeProfile({ id, key: found.key });
  try { history.replaceState(null, '', pathname); } catch { /* not in a browser */ }
  return true;
}

export function api(path, { method = 'GET', body, profile } = {}) {
  return fetch(path, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(profile && { Authorization: `Bearer ${profile.id}.${profile.key}` }) },
    body: body && JSON.stringify(body),
  });
}

let creating = null;
export async function ensureProfile() {
  const have = readProfile();
  if (have) return have;
  creating ||= (async () => {
    const res = await api('/api/profile', { method: 'POST' });
    if (!res.ok) throw new Error(`Could not save (${res.status})`);
    const p = await res.json();
    writeProfile(p);
    const legacy = readMyChannel();
    if (legacy.length) {
      const made = await api('/api/channel', { method: 'POST', profile: p, body: { name: 'My channel', films: legacy.map(film => ({ film })) } });
      if (made.ok) { try { localStorage.removeItem(MY_CHANNEL_KEY); } catch { /* ignore */ } }
    }
    return p;
  })().finally(() => { creating = null; });
  return creating;
}
