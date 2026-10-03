import test from 'node:test';
import assert from 'node:assert/strict';
import { tvPersonal, personalNumber, pinTo, followCopy, MAX_ON_TV } from './yourChannels.js';

const ch = (id, films) => ({ id, name: `Channel ${id}`, status: 'private', films });

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

test('in the order the server sends them (oldest first)', () => {
  const r = tvPersonal({ profileId: 'p1', carriedId: 'p1', channels: [ch('first', 2), ch('middle', 1), ch('newest', 1)] });
  assert.deepEqual(r.saved.map(c => c.id), ['first', 'middle', 'newest']);
});

test('at most ten, the first ten', () => {
  const channels = Array.from({ length: 14 }, (_, i) => ch(`c${i}`, 1));
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

test('the set holds the channel it fell back to', () => {
  const station = { id: 'kung-fu-theater' };
  assert.equal(pinTo('gone', station), 'kung-fu-theater');
  assert.equal(pinTo(null, station), 'kung-fu-theater');
  assert.equal(pinTo('kung-fu-theater', station), null);
  assert.equal(pinTo('gone', null), null);
});

test('mine is left as asked only while the old list can show', () => {
  const station = { id: 'kung-fu-theater' };
  assert.equal(pinTo('mine', station, true), null, 'an empty /tv#mine keeps its panel');
  assert.equal(pinTo('mine', station, false), 'kung-fu-theater', 'otherwise held like any other');
  assert.equal(pinTo('mine', { id: 'c-abc' }, false), 'c-abc');
});

test('watching the old list as it is copied: the old list stays until the copy is on the set', () => {
  const asked = { currentId: 'mine', legacy: false, copied: 'abc' };
  assert.deepEqual(followCopy({ ...asked, onSet: [] }), { id: 'mine', keepOld: true });
  assert.deepEqual(followCopy({ ...asked, onSet: ['c-other', 'kung-fu-theater'] }), { id: 'mine', keepOld: true });
  assert.deepEqual(followCopy({ ...asked, onSet: ['c-other', 'c-abc'] }), { id: 'c-abc', keepOld: false });
});

test('nothing to follow: not on mine, still the old list, or the copy is not known', () => {
  assert.deepEqual(followCopy({ currentId: 'kung-fu-theater', legacy: false, copied: 'abc', onSet: [] }), { id: 'kung-fu-theater', keepOld: false });
  assert.deepEqual(followCopy({ currentId: 'mine', legacy: true, copied: 'abc', onSet: [] }), { id: 'mine', keepOld: false });
  assert.deepEqual(followCopy({ currentId: 'mine', legacy: false, copied: null, onSet: [] }), { id: 'mine', keepOld: false });
  assert.deepEqual(followCopy({ currentId: 'mine', legacy: false, copied: 'abc', onSet: [], left: ['abc'] }), { id: 'mine', keepOld: false }, 'a copy that will not air');
});

test('a copy the loaded profile does not have (deleted, or another profile\'s) does not bring the old list back', () => {
  const asked = { currentId: 'mine', legacy: false, copied: 'abc', onSet: ['c-other'] };
  assert.deepEqual(followCopy({ ...asked, known: ['other'] }), { id: 'mine', keepOld: false });
  assert.deepEqual(followCopy({ ...asked, known: [] }), { id: 'mine', keepOld: false });
  assert.deepEqual(followCopy({ ...asked, known: ['other', 'abc'] }), { id: 'mine', keepOld: true }, 'known, still loading');
  assert.deepEqual(followCopy({ ...asked, known: null }), { id: 'mine', keepOld: true }, 'profile not loaded yet');
});
