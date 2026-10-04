import { startRegistration as sr, startAuthentication as sa } from '@simplewebauthn/browser';
import { switchToProfile, replaceProfile, readProfile, noteStale } from './profile.js';

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

// Tells the platform's passkey manager that the site no longer knows this credential
export function forgetCredential(credentialId) {
  try {
    globalThis.PublicKeyCredential?.signalUnknownCredential?.({ rpId: location.hostname.replace(/^www\./, ''), credentialId })?.catch?.(() => {});
  } catch { /* not supported */ }
}

// On success this browser holds the profile, with a new edit key. The profile it had goes along
// as `from`: the server folds a fresh one in, and then it is gone; any other is kept so the
// owner can switch back.
export async function signInWithPasskey({ fetch: f = fetch, startAuthentication = sa } = {}) {
  try {
    const o = await post(f, '/api/passkey/challenge');
    if (!o.ok) return 'failed';
    const response = await startAuthentication({ optionsJSON: await o.json() });
    const had = readProfile();
    const r = await post(f, '/api/passkey/verify', had ? { ...response, from: { id: had.id, key: had.key } } : response);
    if (r.status === 400) {
      const { error } = await r.json().catch(() => ({}));
      if (error === 'unknown') forgetCredential(response.id);
      return error === 'expired' ? 'expired' : 'none';
    }
    if (!r.ok) return 'failed';
    const { merged, ...p } = await r.json();
    if (merged === 'all') replaceProfile(p); else switchToProfile(p);
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
    if (r.status === 204) forgetCredential(id);
    return r.status === 204;
  } catch { return false; }
}
