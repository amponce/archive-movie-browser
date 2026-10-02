import test from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { keyFromHash, editLink, readProfile, writeProfile, adoptFromLink, readPrevious, switchBack } = await import('./profile.js');
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
