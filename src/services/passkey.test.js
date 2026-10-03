import test from 'node:test';
import assert from 'node:assert/strict';
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { signInWithPasskey, protectProfile } = await import('./passkey.js');
const KEY = 'b'.repeat(64);
const res = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('sign-in stores the returned profile and keeps a different one as previous', async () => {
  store.profile = JSON.stringify({ id: 'aaaaaaaaaa', key: 'a'.repeat(64) });
  const calls = [];
  const fetch = async (url) => { calls.push(url); return url.endsWith('/challenge') ? res(200, { challenge: 'c' }) : res(200, { id: 'bbbbbbbbbb', key: KEY }); };
  const out = await signInWithPasskey({ fetch, startAuthentication: async () => ({ id: 'cred' }) });
  assert.deepEqual(out, { id: 'bbbbbbbbbb' });
  assert.deepEqual(JSON.parse(store.profile), { id: 'bbbbbbbbbb', key: KEY });
  assert.equal(JSON.parse(store['profile-previous']).id, 'aaaaaaaaaa');
});

test('a cancelled prompt is quiet and makes no further calls', async () => {
  const calls = [];
  const fetch = async (url) => { calls.push(url); return res(200, { challenge: 'c' }); };
  const err = Object.assign(new Error('cancel'), { name: 'NotAllowedError' });
  assert.equal(await signInWithPasskey({ fetch, startAuthentication: async () => { throw err; } }), 'cancelled');
  assert.deepEqual(calls, ['/api/passkey/challenge']);
  const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
  assert.equal(await protectProfile({ id: 'aaaaaaaaaa', key: KEY }, { fetch, startRegistration: async () => { throw abort; } }), 'cancelled');
  assert.deepEqual(calls, ['/api/passkey/challenge', '/api/passkey/options']);
});

test('no matching passkey reads as none', async () => {
  const fetch = async (url) => (url.endsWith('/challenge') ? res(200, { challenge: 'c' }) : res(400, { error: 'invalid' }));
  assert.equal(await signInWithPasskey({ fetch, startAuthentication: async () => ({ id: 'x' }) }), 'none');
});

test('a full profile reads as full', async () => {
  const fetch = async () => res(409, { error: 'full' });
  assert.equal(await protectProfile({ id: 'aaaaaaaaaa', key: KEY }, { fetch, startRegistration: async () => ({}) }), 'full');
});
