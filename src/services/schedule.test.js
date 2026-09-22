import test from 'node:test';
import assert from 'node:assert/strict';
import { onAirAt, programmesBetween, tuneIn, airable } from './schedule.js';

const epoch = Date.UTC(2026, 0, 1);
const lineup = [
  { id: 'a', title: 'A', seconds: 3600 },   // slot 0..3630
  { id: 'b', title: 'B', seconds: 1800 },   // slot 3630..5460
  { id: 'nope', title: 'No length' },       // cannot air
  { id: 'c', title: 'C', seconds: 5400 },   // slot 5460..10890
];
const at = seconds => epoch + seconds * 1000;

test('airable drops films with no length', () => {
  assert.deepEqual(airable(lineup).map(f => f.id), ['a', 'b', 'c']);
  assert.equal(onAirAt([{ id: 'x' }], at(0), epoch), null);
});

test('onAirAt finds the film and the offset, and wraps around the cycle', () => {
  assert.equal(onAirAt(lineup, at(0), epoch).film.id, 'a');
  const inB = onAirAt(lineup, at(3630 + 600), epoch);
  assert.equal(inB.film.id, 'b');
  assert.equal(inB.offset, 600);
  assert.equal(inB.startedAt, at(3630));
  assert.equal(inB.endsAt, at(5460));
  assert.equal(onAirAt(lineup, at(10890 + 5), epoch).film.id, 'a', 'the cycle repeats');
  assert.equal(onAirAt(lineup, at(-100), epoch).film.id, 'c', 'before the epoch still lands somewhere sensible');
});

test('the gap between films counts as the film that just ended, capped at its length', () => {
  const gap = onAirAt(lineup, at(3600 + 10), epoch);
  assert.equal(gap.film.id, 'a');
  assert.equal(gap.offset, 3600);
});

test('programmesBetween lists what airs in a window, in order, across the wrap', () => {
  const list = programmesBetween(lineup, at(5000), at(12000), epoch);
  assert.deepEqual(list.map(p => p.film.id), ['b', 'c', 'a']);
  assert.equal(list[1].startsAt, at(5460));
  assert.equal(list[2].startsAt, at(10890));
  assert.deepEqual(programmesBetween([{ id: 'x' }], at(0), at(100), epoch), []);
});

test('tuneIn starts clean in the first minute and skips a film in its last two', () => {
  assert.deepEqual(tuneIn(onAirAt(lineup, at(30), epoch)), { film: lineup[0], offset: 0 });
  assert.equal(tuneIn(onAirAt(lineup, at(900), epoch)).offset, 900);
  assert.equal(tuneIn(onAirAt(lineup, at(3600 - 60), epoch)), null);
  assert.equal(tuneIn(null), null);
});

test('every viewer gets the same answer for the same clock', () => {
  const a = onAirAt(lineup, at(7777), epoch);
  const b = onAirAt(lineup, at(7777), epoch);
  assert.deepEqual(a, b);
});
