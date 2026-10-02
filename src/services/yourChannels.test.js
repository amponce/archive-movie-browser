import test from 'node:test';
import assert from 'node:assert/strict';
import { tvPersonal, personalNumber, MAX_ON_TV } from './yourChannels.js';

const ch = (id, films, created = 0) => ({ id, name: `Channel ${id}`, status: 'private', films, created });

test('no profile: the old browser list, nothing from the server', () => {
  assert.deepEqual(tvPersonal({ profileId: null, carriedId: null, channels: [ch('a', 3)] }), { legacy: true, saved: [] });
});

test('a profile the old list has not been copied into still shows the old list', () => {
  assert.equal(tvPersonal({ profileId: 'p1', carriedId: null, channels: [] }).legacy, true);
  assert.equal(tvPersonal({ profileId: 'p1', carriedId: 'p0', channels: [] }).legacy, true);
});

test('once copied, the old list goes and the saved channels show, empty ones left out', () => {
  const r = tvPersonal({ profileId: 'p1', carriedId: 'p1', channels: [ch('a', 2), ch('b', 0), ch('c', 5)] });
  assert.equal(r.legacy, false);
  assert.deepEqual(r.saved.map(c => c.id), ['a', 'c']);
});

test('oldest first, whatever order they arrive in, so an edit never renumbers them', () => {
  const r = tvPersonal({ profileId: 'p1', carriedId: 'p1', channels: [ch('newest', 1, 300), ch('first', 2, 100), ch('middle', 1, 200)] });
  assert.deepEqual(r.saved.map(c => c.id), ['first', 'middle', 'newest']);
});

test('at most ten, the oldest ten', () => {
  const channels = Array.from({ length: 14 }, (_, i) => ch(`c${i}`, 1, i)).reverse();
  const r = tvPersonal({ profileId: 'p1', carriedId: 'p1', channels });
  assert.equal(r.saved.length, MAX_ON_TV);
  assert.deepEqual(r.saved.map(c => c.id), Array.from({ length: 10 }, (_, i) => `c${i}`));
});

test('profile data not loaded yet: nothing saved, no crash', () => {
  assert.deepEqual(tvPersonal({ profileId: 'p1', carriedId: 'p1', channels: undefined }), { legacy: false, saved: [] });
});

test('personal channels are numbered 0, 0b, 0c ...', () => {
  assert.deepEqual([0, 1, 2, 9].map(personalNumber), ['0', '0b', '0c', '0j']);
});
