// Passkeys for profiles: options, registration, sign-in. `webauthn` is @simplewebauthn/server
// (or a stand-in with the same four functions).
import { hashKey, newKey, authProfile, LIMITS } from './_community.js';

export const MAX_PASSKEYS = 5;
export const CHALLENGE_MS = 300_000;
export const RP_NAME = 'Orphaned Films';
export const PASSKEY_USER = 'Orphaned Films profile';
// A profile this young, with no passkey and no handle, is folded into the one signed in to
export const FRESH_MS = 7 * 86_400_000;

const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

// localhost origins are accepted only when the request itself was made to localhost
export function rpFor(origin, requestUrl) {
  let url;
  try { url = new URL(origin); } catch { return null; }
  let host = '';
  try { host = new URL(requestUrl).hostname; } catch { /* no request url: no localhost */ }
  if (url.protocol === 'https:' && (url.host === 'www.orphanedfilms.com' || url.host === 'orphanedfilms.com')) return { rpID: 'orphanedfilms.com', origin: url.origin };
  if (url.protocol === 'http:' && url.hostname === 'localhost' && (host === 'localhost' || host === '127.0.0.1')) return { rpID: 'localhost', origin: url.origin };
  return null;
}

export const isPasskeyId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{16,1364}$/.test(id);

const liveProfile = (db, id) => db.prepare('SELECT id, webauthn_user, hidden FROM profiles WHERE id = ?').bind(id).first();

async function saveChallenge(db, challenge, kind, profileId, now) {
  await db.batch([
    db.prepare('DELETE FROM challenges WHERE until <= ?').bind(now),
    db.prepare('INSERT INTO challenges (id, kind, profile_id, until) VALUES (?, ?, ?, ?)').bind(challenge, kind, profileId, now + CHALLENGE_MS),
  ]);
}

// Takes a challenge out in one statement (single use, even under concurrent calls). True only if
// it matches kind and profile and is live.
async function takeChallenge(db, challenge, kind, profileId, now) {
  if (typeof challenge !== 'string' || challenge.length > 200) return false;
  const row = await db.prepare('DELETE FROM challenges WHERE id = ? RETURNING kind, profile_id, until').bind(challenge).first();
  return !!row && row.kind === kind && row.until > now && (kind !== 'register' || row.profile_id === profileId);
}

// The challenge the authenticator signed lives in clientDataJSON (base64url JSON)
const clientChallenge = (response) => {
  try { return JSON.parse(new TextDecoder().decode(fromB64u(response.response.clientDataJSON))).challenge; } catch { return null; }
};

export async function registrationOptions(db, webauthn, profileId, { rp, now }) {
  const p = await liveProfile(db, profileId);
  if (!p || p.hidden) return 'hidden';
  const keys = (await db.prepare('SELECT credential_id, transports FROM passkeys WHERE profile_id = ?').bind(profileId).all()).results;
  if (keys.length >= MAX_PASSKEYS) return 'full';
  if (!p.webauthn_user) {
    await db.prepare('UPDATE profiles SET webauthn_user = ? WHERE id = ? AND webauthn_user IS NULL').bind(b64u(crypto.getRandomValues(new Uint8Array(16))), profileId).run();
  }
  const user = (await liveProfile(db, profileId)).webauthn_user;
  const options = await webauthn.generateRegistrationOptions({
    rpName: RP_NAME, rpID: rp.rpID, userID: fromB64u(user), userName: PASSKEY_USER, userDisplayName: PASSKEY_USER,
    attestationType: 'none',
    excludeCredentials: keys.map(k => ({ id: k.credential_id, transports: k.transports ? k.transports.split(',') : undefined })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  await saveChallenge(db, options.challenge, 'register', profileId, now);
  return options;
}

export async function register(db, webauthn, profileId, response, { rp, now }) {
  const challenge = clientChallenge(response);
  if (!(await takeChallenge(db, challenge, 'register', profileId, now))) return 'expired';
  const p = await liveProfile(db, profileId);
  if (!p || p.hidden) return 'invalid';
  let result;
  try {
    result = await webauthn.verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: false });
  } catch { return 'invalid'; }
  if (!result?.verified) return 'invalid';
  const c = result.registrationInfo.credential;
  if (!isPasskeyId(c.id)) return 'invalid';
  // One statement: refuses an existing credential id and enforces the cap
  let changes;
  try {
    ({ meta: { changes } } = await db.prepare(`INSERT INTO passkeys (credential_id, profile_id, public_key, counter, transports, created)
      SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM passkeys WHERE credential_id = ?) AND (SELECT COUNT(*) FROM passkeys WHERE profile_id = ?) < ?`)
      .bind(c.id, profileId, b64u(c.publicKey), c.counter || 0, (c.transports || []).join(','), now, c.id, profileId, MAX_PASSKEYS).run());
  } catch { return 'invalid'; }
  if (changes > 0) return 'ok';
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE profile_id = ?').bind(profileId).first();
  return n >= MAX_PASSKEYS ? 'full' : 'invalid';
}

export async function listPasskeys(db, profileId) {
  return (await db.prepare('SELECT credential_id AS id, created FROM passkeys WHERE profile_id = ? ORDER BY created').bind(profileId).all()).results;
}

export async function removePasskey(db, profileId, credentialId) {
  if (!isPasskeyId(credentialId)) return false;
  const r = await db.prepare('DELETE FROM passkeys WHERE profile_id = ? AND credential_id = ?').bind(profileId, String(credentialId)).run();
  return r.meta.changes > 0;
}

export async function signinOptions(db, webauthn, { rp, now }) {
  const options = await webauthn.generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'preferred' });
  await saveChallenge(db, options.challenge, 'signin', null, now);
  return options;
}

// `from` is the profile the browser held before; see mergeFresh. 'unknown' means no passkey
// has this credential id (it was removed), so the browser can forget it.
export async function signin(db, webauthn, response, { rp, now, from }) {
  const challenge = clientChallenge(response);
  if (!(await takeChallenge(db, challenge, 'signin', null, now))) return 'expired';
  if (!isPasskeyId(response?.id)) return 'invalid';
  const row = await db.prepare('SELECT k.*, p.hidden FROM passkeys k JOIN profiles p ON p.id = k.profile_id WHERE k.credential_id = ?').bind(response.id).first();
  if (!row) return 'unknown';
  let result;
  try {
    result = await webauthn.verifyAuthenticationResponse({
      response, expectedChallenge: challenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: false,
      credential: { id: row.credential_id, publicKey: fromB64u(row.public_key), counter: row.counter, transports: row.transports ? row.transports.split(',') : undefined },
    });
  } catch { return 'invalid'; }
  if (!result?.verified) return 'invalid';
  if (row.hidden) return 'hidden';
  const key = newKey();
  const [, rotated] = await db.batch([
    db.prepare('UPDATE passkeys SET counter = MAX(counter, ?) WHERE credential_id = ?').bind(result.authenticationInfo.newCounter, row.credential_id),
    db.prepare('UPDATE profiles SET key_hash = ?, updated = ? WHERE id = ? AND hidden = 0').bind(await hashKey(key), now, row.profile_id),
  ]);
  if (!rotated.meta.changes) return 'hidden';
  // A merge that fails leaves both profiles as they were; the sign-in still succeeds
  const moved = from ? await mergeFresh(db, row.profile_id, from, { now }).catch(() => null) : null;
  return { id: row.profile_id, key, merged: moved ? moved.merged : 'none', ...(moved && { moved }) };
}

// Folds `from` into profile `into` when its key is right and it is fresh: another profile, no
// passkey, no handle, made within FRESH_MS. Its favourites are copied, its channels (same ids,
// status and films) and saves move over, and it is deleted. When its channels or favourites
// would go past the limits, only the favourites that fit are copied and it stays ('partial').
// Null when nothing was done.
export async function mergeFresh(db, into, from, { now }) {
  const p = await authProfile(db, from?.id, from?.key);
  if (!p || p.id === into || p.handle || now - p.created > FRESH_MS) return null;
  if (await db.prepare('SELECT 1 FROM passkeys WHERE profile_id = ?').bind(p.id).first()) return null;
  const count = (table, id) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE profile_id = ?`).bind(id).first().then(r => r.n);
  const [channels, mine] = [await count('channels', p.id), await count('channels', into)];
  const { n: newFavourites } = await db.prepare('SELECT COUNT(*) AS n FROM favourites WHERE profile_id = ? AND film_id NOT IN (SELECT film_id FROM favourites WHERE profile_id = ?)').bind(p.id, into).first();
  const room = Math.max(0, LIMITS.favourites - await count('favourites', into));
  const all = channels + mine <= LIMITS.channels && newFavourites <= room;
  const copyFavourites = db.prepare(`INSERT OR IGNORE INTO favourites (profile_id, film_id, created)
    SELECT ?, film_id, created FROM favourites WHERE profile_id = ? AND film_id NOT IN (SELECT film_id FROM favourites WHERE profile_id = ?) ORDER BY created DESC LIMIT ?`).bind(into, p.id, into, room);
  try {
    if (!all) {
      const { meta } = await copyFavourites.run();
      return { merged: 'partial', from: p.id, favourites: meta.changes, channels: 0 };
    }
    // Saves of what is now the profile's own channel are dropped. A passkey or channel added to
    // `from` since the checks above makes the profile delete fail, which undoes the whole batch.
    const out = await db.batch([
      copyFavourites,
      db.prepare('UPDATE channels SET profile_id = ? WHERE profile_id = ? AND (SELECT COUNT(*) FROM channels WHERE profile_id IN (?, ?)) <= ?').bind(into, p.id, into, p.id, LIMITS.channels),
      db.prepare(`INSERT OR IGNORE INTO channel_saves (profile_id, channel_id, created)
        SELECT ?, channel_id, created FROM channel_saves WHERE profile_id = ? AND channel_id NOT IN (SELECT id FROM channels WHERE profile_id = ?)`).bind(into, p.id, into),
      db.prepare('DELETE FROM favourites WHERE profile_id = ?').bind(p.id),
      db.prepare('DELETE FROM channel_saves WHERE profile_id = ?').bind(p.id),
      db.prepare('DELETE FROM handle_holds WHERE profile_id = ?').bind(p.id),
      db.prepare('DELETE FROM profiles WHERE id = ?').bind(p.id),
    ]);
    return { merged: 'all', from: p.id, favourites: out[0].meta.changes, channels: out[1].meta.changes };
  } catch (error) {
    console.error('merge:', error.message);
    return null;
  }
}
