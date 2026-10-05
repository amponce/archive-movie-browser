import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAYS, FILMS, pacificDay, openedDays, tonight, inOctober, isFinale, isFinaleDay, ranked, crowdShare, loadSeen, toggleSeen, SEEN_KEY } from './days.js';

// Pacific daylight time is UTC-7 through October 2026; standard time (UTC-8) starts November 1
const at = iso => new Date(iso);

test('the calendar has 31 films, one per day, each in the poster index', () => {
  assert.deepEqual(DAYS.map(d => d.day), Array.from({ length: 31 }, (_, i) => i + 1));
  assert.equal(new Set(FILMS).size, 31);
  const index = JSON.parse(readFileSync(new URL('../../public/poster-index.json', import.meta.url), 'utf8')).films;
  for (const film of FILMS) assert.ok(index[film]?.t, film);
});

test("today is the Pacific date, not the UTC one", () => {
  assert.equal(pacificDay(at('2026-10-01T06:59:00Z')), '2026-09-30');
  assert.equal(pacificDay(at('2026-10-01T07:00:00Z')), '2026-10-01');
  assert.equal(pacificDay(at('2026-11-01T06:59:00Z')), '2026-10-31');
  assert.equal(pacificDay(at('2026-11-01T07:00:00Z')), '2026-11-01');
});

test('days open one at a time through October', () => {
  assert.equal(openedDays(at('2026-09-15T12:00:00Z')), 0, 'before October nothing is open');
  assert.equal(openedDays(at('2026-10-01T06:59:00Z')), 0, 'still September 30 in Los Angeles');
  assert.equal(openedDays(at('2026-10-01T07:00:00Z')), 1, 'midnight October 1 Pacific');
  assert.equal(openedDays(at('2026-10-04T19:00:00Z')), 4);
  assert.equal(openedDays(at('2026-10-31T23:00:00Z')), 31);
  assert.equal(openedDays(at('2026-11-01T07:00:00Z')), 31, 'after October everything is open');
  assert.equal(openedDays(at('2027-03-01T12:00:00Z')), 31);
});

test("tonight's film is October's day, and none outside October", () => {
  assert.equal(tonight(at('2026-09-30T12:00:00Z')), null);
  assert.equal(tonight(at('2026-10-01T07:00:00Z')).day, 1);
  assert.equal(tonight(at('2026-10-04T19:00:00Z')).film, 'the-thing-1987-mca-rainbow-vhs-rip');
  assert.equal(tonight(at('2026-11-01T06:59:00Z')).day, 31);
  assert.equal(tonight(at('2026-11-01T07:00:00Z')), null);
  assert.equal(inOctober(at('2026-10-31T12:00:00Z')), true);
  assert.equal(inOctober(at('2026-11-01T07:00:00Z')), false);
});

test('the scoreboard takes over on October 31 and stays', () => {
  assert.equal(isFinale(at('2026-10-31T06:59:00Z')), false);
  assert.equal(isFinale(at('2026-10-31T07:00:00Z')), true);
  assert.equal(isFinale(at('2026-12-01T12:00:00Z')), true);
  assert.equal(isFinaleDay(at('2026-10-31T07:00:00Z')), true);
  assert.equal(isFinaleDay(at('2026-11-01T07:00:00Z')), false);
});

test('films rank by how many have seen them, calendar order breaking ties', () => {
  const order = ranked({ [FILMS[4]]: 9, [FILMS[2]]: 9, [FILMS[30]]: 12 }).map(d => d.day);
  assert.deepEqual(order.slice(0, 4), [31, 3, 5, 1]);
  assert.deepEqual(ranked().map(d => d.day), DAYS.map(d => d.day));
});

test("the crowd's share shows only once five people have ticked anything", () => {
  assert.equal(crowdShare({ seen: { [FILMS[0]]: 1 }, people: 1 }, FILMS[0]), null);
  assert.equal(crowdShare({ seen: { [FILMS[0]]: 2 }, people: 5 }, FILMS[0]), 40);
  assert.equal(crowdShare({ seen: {}, people: 8 }, FILMS[1]), 0);
  assert.equal(crowdShare({ seen: { [FILMS[0]]: 7 }, people: 6 }, FILMS[0]), 100, 'estimates never pass 100%');
  assert.equal(crowdShare(null, FILMS[0]), null);
});

test('seen films are kept in this browser, ticked and unticked', () => {
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(SEEN_KEY, 'halloween-2026-seen');
  assert.deepEqual(loadSeen(storage), []);
  assert.deepEqual(toggleSeen(loadSeen(storage), FILMS[0], storage), [FILMS[0]]);
  assert.deepEqual(toggleSeen(loadSeen(storage), FILMS[3], storage), [FILMS[0], FILMS[3]]);
  assert.deepEqual(toggleSeen(loadSeen(storage), FILMS[0], storage), [FILMS[3]]);
  assert.deepEqual(JSON.parse(store.get(SEEN_KEY)), [FILMS[3]]);
  store.set(SEEN_KEY, JSON.stringify([FILMS[1], 'not-a-halloween-film']));
  assert.deepEqual(loadSeen(storage), [FILMS[1]], 'anything else in the list is ignored');
  store.set(SEEN_KEY, '{broken');
  assert.deepEqual(loadSeen(storage), []);
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSeen(blocked), []);
  assert.deepEqual(toggleSeen(toggleSeen([], FILMS[2], blocked), FILMS[5], blocked), [FILMS[2], FILMS[5]], 'storage off: ticks last for the page');
});
