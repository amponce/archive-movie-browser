import test from 'node:test';
import assert from 'node:assert/strict';
const store = {};
const session = {};
globalThis.sessionStorage = { getItem: k => session[k] ?? null, setItem: (k, v) => { session[k] = String(v); }, removeItem: k => { delete session[k]; } };
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { signInWithPasskey, protectProfile, listPasskeys, removePasskey } = await import('./passkey.js');
const KEY = 'b'.repeat(64);
const res = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('with no profile in this browser, sign-in sends no from', async () => {
  let sent;
  const fetch = async (url, init) => { if (url.endsWith('/challenge')) return res(200, { challenge: 'c' }); sent = JSON.parse(init.body); return res(400, { error: 'invalid' }); };
  await signInWithPasskey({ fetch, startAuthentication: async () => ({ id: 'cred' }) });
  assert.deepEqual(sent, { id: 'cred' });
});

test('sign-in stores the returned profile and keeps a different one as previous', async () => {
  store.profile = JSON.stringify({ id: 'aaaaaaaaaa', key: 'a'.repeat(64) });
  const calls = [];
  const fetch = async (url) => { calls.push(url); return url.endsWith('/challenge') ? res(200, { challenge: 'c' }) : res(200, { id: 'bbbbbbbbbb', key: KEY }); };
  const out = await signInWithPasskey({ fetch, startAuthentication: async () => ({ id: 'cred' }) });
  assert.deepEqual(out, { id: 'bbbbbbbbbb' });
  assert.deepEqual(JSON.parse(store.profile), { id: 'bbbbbbbbbb', key: KEY });
  assert.equal(JSON.parse(store['profile-previous']).id, 'aaaaaaaaaa');
  assert.equal(session['profile-link-new'], 'bbbbbbbbbb', 'the profile page shows the new link once');
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

test('an expired challenge reads as expired, not as no passkey', async () => {
  const fetch = async (url) => (url.endsWith('/challenge') ? res(200, { challenge: 'c' }) : res(400, { error: 'expired' }));
  assert.equal(await signInWithPasskey({ fetch, startAuthentication: async () => ({ id: 'x' }) }), 'expired');
});

test('a device that already has a passkey for the profile reads as exists', async () => {
  const fetch = async () => res(200, { challenge: 'c' });
  const err = Object.assign(new Error('excluded'), { name: 'InvalidStateError' });
  assert.equal(await protectProfile({ id: 'aaaaaaaaaa', key: KEY }, { fetch, startRegistration: async () => { throw err; } }), 'exists');
});

test('a failed list is null, not empty', async () => {
  assert.equal(await listPasskeys({ id: 'aaaaaaaaaa', key: KEY }, { fetch: async () => res(401) }), null);
  assert.deepEqual(await listPasskeys({ id: 'aaaaaaaaaa', key: KEY }, { fetch: async () => res(200, { passkeys: [] }) }), []);
});

test('sign-in sends the stored profile as from; a profile folded in is not kept as previous', async () => {
  for (const k of Object.keys(store)) delete store[k];
  store.profile = JSON.stringify({ id: 'cccccccccc', key: 'c'.repeat(64) });
  store['profile-carried'] = 'cccccccccc';
  let sent;
  const fetch = async (url, init) => {
    if (url.endsWith('/challenge')) return res(200, { challenge: 'c' });
    sent = JSON.parse(init.body);
    return res(200, { id: 'dddddddddd', key: KEY, merged: 'all' });
  };
  assert.deepEqual(await signInWithPasskey({ fetch, startAuthentication: async () => ({ id: 'cred' }) }), { id: 'dddddddddd' });
  assert.deepEqual(sent, { id: 'cred', from: { id: 'cccccccccc', key: 'c'.repeat(64) } });
  assert.deepEqual(JSON.parse(store.profile), { id: 'dddddddddd', key: KEY });
  assert.equal(store['profile-previous'], undefined, 'the folded-in profile no longer exists');
  assert.equal(store['profile-carried'], 'dddddddddd', 'the copied list went with it');
});

test('a partial or no merge keeps the old profile as previous', async () => {
  for (const merged of ['partial', 'none']) {
    for (const k of Object.keys(store)) delete store[k];
    store.profile = JSON.stringify({ id: 'cccccccccc', key: 'c'.repeat(64) });
    const fetch = async (url) => (url.endsWith('/challenge') ? res(200, { challenge: 'c' }) : res(200, { id: 'dddddddddd', key: KEY, merged }));
    await signInWithPasskey({ fetch, startAuthentication: async () => ({ id: 'cred' }) });
    assert.equal(JSON.parse(store['profile-previous']).id, 'cccccccccc', merged);
  }
});

test('an unknown credential, and a removed one, are signalled to the passkey manager', async () => {
  const signals = [];
  globalThis.location = { hostname: 'www.orphanedfilms.com' };
  globalThis.PublicKeyCredential = { signalUnknownCredential: async (o) => { signals.push(o); } };
  try {
    const unknown = async (url) => (url.endsWith('/challenge') ? res(200, { challenge: 'c' }) : res(400, { error: 'unknown' }));
    assert.equal(await signInWithPasskey({ fetch: unknown, startAuthentication: async () => ({ id: 'gone' }) }), 'none');
    const invalid = async (url) => (url.endsWith('/challenge') ? res(200, { challenge: 'c' }) : res(400, { error: 'invalid' }));
    assert.equal(await signInWithPasskey({ fetch: invalid, startAuthentication: async () => ({ id: 'bad' }) }), 'none');
    assert.equal(await removePasskey({ id: 'aaaaaaaaaa', key: KEY }, 'removed', { fetch: async () => res(204) }), true);
    assert.equal(await removePasskey({ id: 'aaaaaaaaaa', key: KEY }, 'kept', { fetch: async () => res(404) }), false);
    assert.deepEqual(signals, [{ rpId: 'orphanedfilms.com', credentialId: 'gone' }, { rpId: 'orphanedfilms.com', credentialId: 'removed' }]);
    globalThis.PublicKeyCredential = {};
    assert.equal(await removePasskey({ id: 'aaaaaaaaaa', key: KEY }, 'removed', { fetch: async () => res(204) }), true, 'no signal support is fine');
  } finally {
    delete globalThis.PublicKeyCredential;
    delete globalThis.location;
  }
});
