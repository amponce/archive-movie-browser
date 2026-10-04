import test from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { keyFromHash, editLink, readProfile, writeProfile, adoptFromLink, readPrevious, switchBack, carriedChannel } = await import('./profile.js');
const KEY = 'a'.repeat(64);

test('the key comes only from a well-formed fragment', () => {
  assert.deepEqual(keyFromHash(`#key=${KEY}`), { key: KEY });
  assert.equal(keyFromHash('#key=short'), null);
  assert.equal(keyFromHash(''), null);
});

test('edit link puts the key after #', () => {
  assert.equal(editLink('https://www.orphanedfilms.com', { id: 'abcdefghij', key: KEY }), `https://www.orphanedfilms.com/u/abcdefghij#key=${KEY}`);
});

test('an edit link replaces whatever profile this browser had', () => {
  writeProfile({ id: 'oldoldoldo', key: 'b'.repeat(64) });
  globalThis.history = { replaceState: () => {} };
  assert.equal(adoptFromLink('/u/abcdefghij', `#key=${KEY}`), true);
  assert.deepEqual(readProfile(), { id: 'abcdefghij', key: KEY });
  assert.equal(adoptFromLink('/c/abcdefghij', `#key=${KEY}`), false);
});

test('a handle address with a key is never adopted', () => {
  writeProfile({ id: 'oldoldoldo', key: 'b'.repeat(64) });
  for (const path of ['/u/night-owl', '/u/night-owl/', '/u/abcdefgh1j']) assert.equal(adoptFromLink(path, `#key=${KEY}`), false, path);
  assert.deepEqual(readProfile(), { id: 'oldoldoldo', key: 'b'.repeat(64) });
});

test('an edit link with a trailing slash is adopted too', () => {
  writeProfile({ id: 'oldoldoldo', key: 'b'.repeat(64) });
  let replaced = null;
  globalThis.history = { replaceState: (_, __, url) => { replaced = url; } };
  assert.equal(adoptFromLink('/u/abcdefghij/', `#key=${KEY}`), true);
  assert.deepEqual(readProfile(), { id: 'abcdefghij', key: KEY });
  assert.equal(replaced, '/u/abcdefghij/');
});

test('the profile an edit link replaced is kept, and switching back swaps them', () => {
  for (const k of Object.keys(store)) delete store[k];
  const old = { id: 'oldoldoldo', key: 'b'.repeat(64) };
  writeProfile(old);
  store['profile-carried'] = old.id;
  globalThis.history = { replaceState: () => {} };
  adoptFromLink('/u/abcdefghij', `#key=${KEY}`);
  assert.deepEqual(readPrevious(), { ...old, carried: true });
  assert.equal(switchBack(), true);
  assert.deepEqual(readProfile(), old);
  assert.deepEqual(readPrevious(), { id: 'abcdefghij', key: KEY, carried: false });
  assert.equal(store['profile-carried'], old.id, 'the old list is not copied into it again');
  assert.equal(switchBack(), true);
  assert.deepEqual(readProfile(), { id: 'abcdefghij', key: KEY });
});

test('switching back brings back the channel the old list was copied into', () => {
  for (const k of Object.keys(store)) delete store[k];
  const old = { id: 'oldoldoldo', key: 'b'.repeat(64) };
  writeProfile(old);
  store['profile-carried'] = old.id;
  store['profile-carried-channel'] = 'oldcopyaaa';
  globalThis.history = { replaceState: () => {} };
  adoptFromLink('/u/abcdefghij', `#key=${KEY}`);
  assert.deepEqual(readPrevious(), { ...old, carried: true, copy: 'oldcopyaaa' });
  // the new profile gets a copy of its own
  store['profile-carried'] = 'abcdefghij';
  store['profile-carried-channel'] = 'newcopyaaa';
  assert.equal(switchBack(), true);
  assert.equal(carriedChannel(), 'oldcopyaaa');
  assert.deepEqual(readPrevious(), { id: 'abcdefghij', key: KEY, carried: true, copy: 'newcopyaaa' });
  assert.equal(switchBack(), true);
  assert.equal(carriedChannel(), 'newcopyaaa');
});

test('switching back to a profile with no known copy forgets the other one', () => {
  for (const k of Object.keys(store)) delete store[k];
  const old = { id: 'oldoldoldo', key: 'b'.repeat(64) };
  writeProfile({ id: 'abcdefghij', key: KEY });
  store['profile-carried'] = 'abcdefghij';
  store['profile-carried-channel'] = 'newcopyaaa';
  store['profile-previous'] = JSON.stringify({ ...old, carried: true });
  assert.equal(switchBack(), true);
  assert.equal(store['profile-carried'], old.id);
  assert.equal(store['profile-carried-channel'], undefined);
});

test('opening your own edit link again keeps nothing to switch back to', () => {
  for (const k of Object.keys(store)) delete store[k];
  writeProfile({ id: 'abcdefghij', key: KEY });
  adoptFromLink('/u/abcdefghij', `#key=${KEY}`);
  assert.equal(readPrevious(), null);
  assert.equal(switchBack(), false);
  assert.deepEqual(readProfile(), { id: 'abcdefghij', key: KEY });
});

const ID = 'abcdefghij';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const reset = () => { for (const k of Object.keys(store)) delete store[k]; };

test('two concurrent ensureProfile calls make one profile', async () => {
  reset();
  let posts = 0;
  globalThis.fetch = async path => { if (path === '/api/profile') { posts++; return json(201, { id: ID, key: KEY }); } return json(201, {}); };
  const fresh = await import('./profile.js?concurrent');
  const [a, b] = await Promise.all([fresh.ensureProfile(), fresh.ensureProfile()]);
  assert.equal(posts, 1);
  assert.deepEqual(a, b);
});

test('a failed carry-over keeps the old list and is retried later', async () => {
  reset();
  const fresh = await import('./profile.js?retry');
  store['tv-my-channel'] = JSON.stringify(['film-one']);
  let channelStatus = 500; let channelPosts = 0;
  globalThis.fetch = async path => {
    if (path === '/api/profile') return json(201, { id: ID, key: KEY });
    channelPosts++; return json(channelStatus, {});
  };
  assert.deepEqual(await fresh.ensureProfile(), { id: ID, key: KEY });
  assert.ok(store['tv-my-channel']);
  assert.equal(store['profile-carried'], undefined);
  channelStatus = 201;
  await fresh.ensureProfile();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(channelPosts, 2);
  assert.equal(store['profile-carried'], ID);
});

test('a successful carry-over keeps the old list and happens once per profile', async () => {
  reset();
  const fresh = await import('./profile.js?once');
  store['tv-my-channel'] = JSON.stringify(['film-one', 'film-two']);
  let channelPosts = 0;
  globalThis.fetch = async path => {
    if (path === '/api/profile') return json(201, { id: ID, key: KEY });
    channelPosts++; return json(201, { id: 'chan' });
  };
  await fresh.ensureProfile();
  assert.equal(channelPosts, 1);
  assert.equal(store['tv-my-channel'], JSON.stringify(['film-one', 'film-two']));
  assert.equal(fresh.carriedChannel(), 'chan', 'the copy is remembered, so the TV can stay on it');
  await fresh.ensureProfile();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(channelPosts, 1);
  assert.equal(store['tv-my-channel'], JSON.stringify(['film-one', 'film-two']));
});

test('a throwing carry-over does not stop ensureProfile', async () => {
  reset();
  const fresh = await import('./profile.js?throws');
  store['tv-my-channel'] = JSON.stringify(['film-one']);
  globalThis.fetch = async path => { if (path === '/api/profile') return json(201, { id: ID, key: KEY }); throw new Error('offline'); };
  assert.deepEqual(await fresh.ensureProfile(), { id: ID, key: KEY });
  assert.ok(store['tv-my-channel']);
});

test('asking to keep storage never throws, with or without browser support', async () => {
  const { keepStorage } = await import('./profile.js');
  let asked = 0;
  assert.equal(await keepStorage({ storage: { persist: async () => { asked++; return true; } } }), true);
  assert.equal(asked, 1);
  assert.equal(await keepStorage({ storage: { persist: async () => { throw new Error('no'); } } }), false);
  assert.equal(await keepStorage({}), undefined);
  assert.equal(await keepStorage(undefined), undefined);
});

test('a 401 on a call with this browser\'s profile is reported; other calls are not', async () => {
  const { api, onStaleKey } = await import('./profile.js');
  const me = { id: 'abcdefghij', key: KEY };
  writeProfile(me);
  let seen = 0;
  const off = onStaleKey(() => { seen++; });
  const was = globalThis.fetch;
  let status = 401;
  globalThis.fetch = async () => new Response(null, { status });
  try {
    assert.equal((await api('/api/profile/abcdefghij', { method: 'PATCH', profile: me, body: {} })).status, 401);
    assert.equal(seen, 1);
    await api('/api/profile', { method: 'POST' }); // no profile sent
    await api('/x', { profile: { id: 'otherother', key: KEY } }); // not this browser's profile
    await api('/x', { profile: { id: 'abcdefghij', key: 'c'.repeat(64) } }); // an older key, already replaced here
    status = 204;
    await api('/api/profile/abcdefghij', { method: 'PATCH', profile: me, body: {} });
    assert.equal(seen, 1);
  } finally { globalThis.fetch = was; off(); }
});

test('a profile started here is remembered for this tab only, and only for its own id', async () => {
  const { markStarted, justStarted } = await import('./profile.js');
  const was = globalThis.sessionStorage;
  try {
    assert.equal(justStarted('abcdefghij'), false); // no sessionStorage at all
    const tab = {};
    globalThis.sessionStorage = { getItem: k => tab[k] ?? null, setItem: (k, v) => { tab[k] = String(v); } };
    assert.equal(justStarted('abcdefghij'), false);
    markStarted('abcdefghij');
    assert.equal(justStarted('abcdefghij'), true);
    assert.equal(justStarted('otherother'), false);
    assert.equal(justStarted(null), false);
    globalThis.sessionStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    markStarted('abcdefghij');
    assert.equal(justStarted('abcdefghij'), false);
  } finally { globalThis.sessionStorage = was; }
});

test('a removed profile is forgotten', async () => {
  const { forgetProfile, readProfile, writeProfile } = await import('./profile.js');
  writeProfile({ id: 'abcdefghij', key: 'a'.repeat(64) });
  forgetProfile();
  assert.equal(readProfile(), null);
});
