import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageFor } from './pages.js';

test('the front page, the browser and the side pages route as before', () => {
  assert.deepEqual(pageFor('/'), { key: '/' });
  assert.equal(pageFor('/', '?genre=Horror'), null);
  assert.equal(pageFor('/', '', '#Detour'), null);
  assert.equal(pageFor('/browse'), null);
  assert.deepEqual(pageFor('/tv/'), { key: '/tv' });
  assert.deepEqual(pageFor('/lists/noir-you-can-finish-tonight'), { key: '/lists', slug: 'noir-you-can-finish-tonight' });
  assert.deepEqual(pageFor('/halloween'), { key: '/halloween' });
  assert.equal(pageFor('/nope'), null);
});

test('channel, profile and community pages route', () => {
  assert.deepEqual(pageFor('/c/abcdefghij'), { key: '/c', slug: 'abcdefghij' });
  assert.deepEqual(pageFor('/u/abcdefghij'), { key: '/u', slug: 'abcdefghij' });
  assert.deepEqual(pageFor('/channels'), { key: '/channels' });
  assert.equal(pageFor('/c/NOPE'), null);
  assert.equal(pageFor('/c/abcdefghij/x'), null);
  assert.equal(pageFor('/c/abcdefgh1j'), null);
});

test('a profile page routes by handle too', () => {
  assert.deepEqual(pageFor('/u/midnight-projector'), { key: '/u', slug: 'midnight-projector' });
  assert.deepEqual(pageFor('/u/abcdefgh1j/'), { key: '/u', slug: 'abcdefgh1j' });
  assert.equal(pageFor('/c/midnight-projector'), null);
  for (const path of ['/u/ab', '/u/Midnight', '/u/-abc', '/u/a--b', `/u/${'a'.repeat(31)}`]) assert.equal(pageFor(path), null, path);
});
