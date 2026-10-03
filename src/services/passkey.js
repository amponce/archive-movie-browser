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
// Registration refused because this device already holds a passkey for the profile
const exists = e => e?.name === 'InvalidStateError';

// Set by a sign-in, which replaces the edit key: the profile page shows the new link once
export const NEW_LINK = 'profile-link-new';

export async function protectProfile(profile, { fetch: f = fetch, startRegistration = sr } = {}) {
  try {
    const o = await post(f, '/api/passkey/options', undefined, profile);
    if (o.status === 409) return 'full';
    if (!o.ok) return 'failed';
    const response = await startRegistration({ optionsJSON: await o.json() });
    const r = await post(f, '/api/passkey', response, profile);
    return r.status === 204 ? 'ok' : 'failed';
  } catch (e) { return cancelled(e) ? 'cancelled' : exists(e) ? 'exists' : 'failed'; }
}

// On success this browser holds the profile, with a new edit key; a different profile it had is
// kept so the owner can switch back
export async function signInWithPasskey({ fetch: f = fetch, startAuthentication = sa } = {}) {
  try {
    const o = await post(f, '/api/passkey/challenge');
    if (!o.ok) return 'failed';
    const response = await startAuthentication({ optionsJSON: await o.json() });
    const r = await post(f, '/api/passkey/verify', response);
    if (r.status === 400) return (await r.json().catch(() => ({}))).error === 'expired' ? 'expired' : 'none';
    if (!r.ok) return 'failed';
    const p = await r.json();
    switchToProfile(p);
    try { sessionStorage.setItem(NEW_LINK, p.id); } catch { /* private mode */ }
    return { id: p.id };
  } catch (e) { return cancelled(e) ? 'cancelled' : 'failed'; }
}

export async function listPasskeys(profile, { fetch: f = fetch } = {}) {
  try {
    const r = noteStale(await f('/api/passkey', { headers: auth(profile) }), profile);
    return r.ok ? (await r.json()).passkeys : null;
  } catch { return null; }
}

export async function removePasskey(profile, id, { fetch: f = fetch } = {}) {
  try {
    const r = noteStale(await f(`/api/passkey/${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth(profile) }), profile);
    return r.status === 204;
  } catch { return false; }
}
