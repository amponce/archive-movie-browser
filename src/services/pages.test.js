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
  assert.equal(pageFor('/nope'), null);
});

test('channel, profile and community pages route', () => {
  assert.deepEqual(pageFor('/c/abcdefghij'), { key: '/c', slug: 'abcdefghij' });
  assert.deepEqual(pageFor('/u/abcdefghij'), { key: '/u', slug: 'abcdefghij' });
  assert.deepEqual(pageFor('/channels'), { key: '/channels' });
  assert.equal(pageFor('/c/NOPE'), null);
  assert.equal(pageFor('/c/abcdefghij/x'), null);
  assert.equal(pageFor('/u/abcdefgh1j'), null);
});
