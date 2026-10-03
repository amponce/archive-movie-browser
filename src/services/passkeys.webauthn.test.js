// Round trips against the real @simplewebauthn/server with a software authenticator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import * as webauthn from '@simplewebauthn/server';
import { openTestDb } from './testDb.js';
import { createProfile } from '../../api/_community.js';
import { registrationOptions, register, signinOptions, signin } from '../../api/_passkeys.js';

const now = 1_800_000_000_000;
const rp = { rpID: 'orphanedfilms.com', origin: 'https://www.orphanedfilms.com' };
const b64u = bytes => Buffer.from(bytes).toString('base64url');
const sha256 = data => new Uint8Array(createHash('sha256').update(data).digest());
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };

// Minimal CBOR: unsigned/negative ints, byte strings, text, maps (a Map keeps integer keys)
function cbor(value) {
  const head = (major, n) => (n < 24 ? Uint8Array.of(major << 5 | n) : n < 256 ? Uint8Array.of(major << 5 | 24, n) : Uint8Array.of(major << 5 | 25, n >> 8, n & 255));
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === 'string') { const b = new TextEncoder().encode(value); return concat(head(3, b.length), b); }
  if (value instanceof Uint8Array) return concat(head(2, value.length), value);
  return concat(head(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)]));
}

// ES256 signatures from WebCrypto are r||s; WebAuthn wants DER
function der(raw) {
  const int = bytes => { let i = 0; while (i < bytes.length - 1 && bytes[i] === 0) i++; const b = bytes.slice(i); return b[0] & 0x80 ? concat(Uint8Array.of(0), b) : b; };
  const part = bytes => { const b = int(bytes); return concat(Uint8Array.of(2, b.length), b); };
  const body = concat(part(raw.slice(0, 32)), part(raw.slice(32)));
  return concat(Uint8Array.of(0x30, body.length), body);
}

async function authenticator() {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const id = webcrypto.getRandomValues(new Uint8Array(32));
  const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]);
  const counter = n => Uint8Array.of(n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255);
  const clientData = (type, challenge, origin) => new TextEncoder().encode(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  return {
    id: b64u(id),
    create(challenge, { origin = rp.origin, rpID = rp.rpID } = {}) {
      const authData = concat(sha256(rpID), Uint8Array.of(0x41), counter(0), new Uint8Array(16), Uint8Array.of(0, id.length), id, cbor(cose));
      return {
        id: b64u(id), rawId: b64u(id), type: 'public-key', clientExtensionResults: {},
        response: { clientDataJSON: b64u(clientData('webauthn.create', challenge, origin)), attestationObject: b64u(cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))), transports: ['internal'] },
      };
    },
    async get(challenge, n, { origin = rp.origin, rpID = rp.rpID } = {}) {
      const authData = concat(sha256(rpID), Uint8Array.of(0x01), counter(n));
      const data = clientData('webauthn.get', challenge, origin);
      const sig = new Uint8Array(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, concat(authData, sha256(data))));
      return { id: b64u(id), rawId: b64u(id), type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: b64u(data), authenticatorData: b64u(authData), signature: b64u(der(sig)) } };
    },
  };
}

async function registered(db) {
  const p = await createProfile(db, { now });
  const a = await authenticator();
  const o = await registrationOptions(db, webauthn, p.id, { rp, now });
  assert.equal(await register(db, webauthn, p.id, a.create(o.challenge), { rp, now }), 'ok');
  return { p, a };
}

test('real library: register then sign in', async () => {
  const db = await openTestDb();
  const { p, a } = await registered(db);
  const so = await signinOptions(db, webauthn, { rp, now });
  const out = await signin(db, webauthn, await a.get(so.challenge, 1), { rp, now });
  assert.equal(out.id, p.id);
  assert.match(out.key, /^[0-9a-f]{64}$/);
});

test('real library: wrong origin or relying party is refused', async () => {
  const db = await openTestDb();
  const p = await createProfile(db, { now });
  const a = await authenticator();
  let o = await registrationOptions(db, webauthn, p.id, { rp, now });
  assert.equal(await register(db, webauthn, p.id, a.create(o.challenge, { origin: 'https://evil.example' }), { rp, now }), 'invalid');
  o = await registrationOptions(db, webauthn, p.id, { rp, now });
  assert.equal(await register(db, webauthn, p.id, a.create(o.challenge, { rpID: 'evil.example' }), { rp, now }), 'invalid');
  const { a: b } = await registered(db);
  let so = await signinOptions(db, webauthn, { rp, now });
  assert.equal(await signin(db, webauthn, await b.get(so.challenge, 1, { origin: 'https://evil.example' }), { rp, now }), 'invalid');
  so = await signinOptions(db, webauthn, { rp, now });
  assert.equal(await signin(db, webauthn, await b.get(so.challenge, 1, { rpID: 'evil.example' }), { rp, now }), 'invalid');
});

test('real library: a counter that does not go up is refused', async () => {
  const db = await openTestDb();
  const { a } = await registered(db);
  let so = await signinOptions(db, webauthn, { rp, now });
  assert.ok((await signin(db, webauthn, await a.get(so.challenge, 5), { rp, now })).key);
  so = await signinOptions(db, webauthn, { rp, now });
  assert.equal(await signin(db, webauthn, await a.get(so.challenge, 3), { rp, now }), 'invalid');
});

test('real library: challenges are bound to their kind', async () => {
  const db = await openTestDb();
  const p = await createProfile(db, { now });
  const a = await authenticator();
  const so = await signinOptions(db, webauthn, { rp, now });
  assert.equal(await register(db, webauthn, p.id, a.create(so.challenge), { rp, now }), 'expired');
  const o = await registrationOptions(db, webauthn, p.id, { rp, now });
  assert.equal(await signin(db, webauthn, await a.get(o.challenge, 1), { rp, now }), 'expired');
});
