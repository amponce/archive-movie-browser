import { startRegistration as sr, startAuthentication as sa } from '@simplewebauthn/browser';
import { switchToProfile, noteStale } from './profile.js';

const auth = profile => profile && { Authorization: `Bearer ${profile.id}.${profile.key}` };
const post = (f, path, body, profile) => f(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth(profile) },
  body: body === undefined ? undefined : JSON.stringify(body),
}).then(res => noteStale(res, profile));
// The person closed the platform prompt
const cancelled = e => e?.name === 'NotAllowedError' || e?.name === 'AbortError';

export async function protectProfile(profile, { fetch: f = fetch, startRegistration = sr } = {}) {
  try {
    const o = await post(f, '/api/passkey/options', undefined, profile);
    if (o.status === 409) return 'full';
    if (!o.ok) return 'failed';
    const response = await startRegistration({ optionsJSON: await o.json() });
    const r = await post(f, '/api/passkey', response, profile);
    return r.status === 204 ? 'ok' : 'failed';
  } catch (e) { return cancelled(e) ? 'cancelled' : 'failed'; }
}

// On success this browser holds the profile, with a new edit key; a different profile it had is
// kept so the owner can switch back
export async function signInWithPasskey({ fetch: f = fetch, startAuthentication = sa } = {}) {
  try {
    const o = await post(f, '/api/passkey/challenge');
    if (!o.ok) return 'failed';
    const response = await startAuthentication({ optionsJSON: await o.json() });
    const r = await post(f, '/api/passkey/verify', response);
    if (r.status === 400) return 'none';
    if (!r.ok) return 'failed';
    const p = await r.json();
    switchToProfile(p);
    return { id: p.id };
  } catch (e) { return cancelled(e) ? 'cancelled' : 'failed'; }
}

export async function listPasskeys(profile, { fetch: f = fetch } = {}) {
  try {
    const r = noteStale(await f('/api/passkey', { headers: auth(profile) }), profile);
    return r.ok ? (await r.json()).passkeys : [];
  } catch { return []; }
}

export async function removePasskey(profile, id, { fetch: f = fetch } = {}) {
  try {
    const r = noteStale(await f(`/api/passkey/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(profile) }), profile);
    return r.status === 204;
  } catch { return false; }
}
