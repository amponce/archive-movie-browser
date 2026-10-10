import test from 'node:test';
import assert from 'node:assert/strict';
import { tvPersonal, personalNumber, pinTo, followCopy, awaitingSaved, toFetch, airable, onDemandIds, MAX_ON_TV } from './yourChannels.js';

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
  assert.deepEqual(r.saved[0], { id: 'a', name: 'Channel a', films: 2 });
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

test('personal channels are lettered A, B, C ...', () => {
  assert.deepEqual([0, 1, 2, 9].map(personalNumber), ['A', 'B', 'C', 'J']);
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

test('the set waits for the profile, then its channels, and stops once a load ends with nothing', () => {
  const me = { channels: [] };
  assert.equal(awaitingSaved({ profileId: null, me: null, tried: false, pending: false }), false, 'no profile');
  assert.equal(awaitingSaved({ profileId: 'p1', me: null, tried: false, pending: false }), true, 'loading');
  assert.equal(awaitingSaved({ profileId: 'p1', me: null, tried: true, pending: false }), false, 'failed');
  assert.equal(awaitingSaved({ profileId: 'p1', me, tried: true, pending: true }), true, 'channels loading');
  assert.equal(awaitingSaved({ profileId: 'p1', me, tried: true, pending: false }), false);
});

test('only new channels, and ones whose films changed, are loaded again', () => {
  const list = [{ id: 'a', films: 2 }, { id: 'b', films: 4 }, { id: 'c', films: 1 }];
  assert.deepEqual(toFetch(list, {}).map(c => c.id), ['a', 'b', 'c']);
  assert.deepEqual(toFetch(list, { a: 2, b: 3, c: 1 }).map(c => c.id), ['b'], 'a film was added to b');
  assert.deepEqual(toFetch(list, { a: 2, b: 4 }).map(c => c.id), ['c']);
  assert.deepEqual(toFetch(list, { a: 2, b: 4, c: 1 }), []);
});

test('a saved channel that failed or has nothing on leaves a gap; the rest keep their numbers', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const loaded = { a: [1], b: [], d: [1] };
  assert.deepEqual(airable(list, loaded).map(c => [c.id, c.number]), [['a', 'A'], ['d', 'D']]);
  assert.deepEqual(airable(list, {}), []);
});

test('on demand: the profile\'s own channels and this browser\'s own list, not a shared link or a station', () => {
  const ids = onDemandIds({ own: ['c-a', 'c-b'], mine: { id: 'mine', mine: true } });
  assert.deepEqual([...ids], ['c-a', 'c-b', 'mine']);
  assert.equal(onDemandIds({ own: [], mine: { id: 'mine', mine: false } }).has('mine'), false);
  assert.equal(onDemandIds({ own: ['c-a'], mine: null }).has('atomic-age'), false);
});

test('on demand on a channel page: only when this profile made or saved the channel', () => {
  const page = { id: 'c-x', mine: false };
  assert.equal(onDemandIds({ mine: page, kept: true }).has('c-x'), true);
  assert.equal(onDemandIds({ mine: page, kept: false }).has('c-x'), false);
});
