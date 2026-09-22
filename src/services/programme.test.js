import test from 'node:test';
import assert from 'node:assert/strict';
import { featuredFor, rowFor, wantedFrom, countsOf, changesIn, shelfFor } from './programme.js';

const index = {
  loved_unseen: { i: 1, t: 'Messiah of Evil', y: 1975, p: '/a.jpg', v: 7.9, c: 0.95 },
  popular: { i: 2, t: 'Night of the Living Dead', y: 1968, p: '/b.jpg', v: 7.6, c: 1 },
  shaky: { i: 3, t: 'Something', y: 1980, p: '/c.jpg', v: 9.9, c: 0.72 },
  no_poster: { n: 1, c: 0.9 },
  no_poster_2: { n: 1, c: 0.4 },
  western: { i: 4, t: 'The Bat', y: 1926, p: '/d.jpg', v: 6.1, c: 0.9 },
  renamed: { i: 5, t: 'Sherlock Jr.', y: 1924, p: '/e.jpg', v: 8.0, c: 1 },
};

test('featuredFor picks a confident, well-rated film with a poster, and changes with the day', () => {
  const a = featuredFor(index, new Date('2026-09-22T12:00:00Z'));
  assert.ok(['loved_unseen', 'popular', 'renamed'].includes(a.id), a.id);
  assert.ok(a.entry.c >= 0.8 && a.entry.p, 'never a shaky match or a missing poster');
  const days = new Set(Array.from({ length: 10 }, (_, i) => featuredFor(index, new Date(Date.UTC(2026, 8, 22 + i))).id));
  assert.ok(days.size > 1, 'a different film on different days');
  assert.equal(featuredFor(index, new Date('2026-09-22T12:00:00Z')).id, a.id, 'the same film all day');
});

test('rowFor returns the best films of a decade, poster and confidence required', () => {
  assert.deepEqual(rowFor(index, { decade: 1960 }).map(f => f.id), ['popular']);
  assert.deepEqual(rowFor(index).map(f => f.id), ['renamed', 'loved_unseen', 'popular', 'western'], 'rated order, shaky left out');
  assert.deepEqual(rowFor(index, { decade: 2000 }), []);
});

test('wantedFrom lists only films decided to have no poster, a stable pick per day', () => {
  const day = new Date('2026-09-22T12:00:00Z');
  const picks = wantedFrom(index, 5, day);
  assert.deepEqual([...picks].sort(), ['no_poster', 'no_poster_2']);
  assert.deepEqual(wantedFrom(index, 1, day), wantedFrom(index, 1, new Date('2026-09-22T23:00:00Z')));
});

test('countsOf gives the real numbers', () => {
  assert.deepEqual(countsOf(index), { identified: 5, posters: 5, wanted: 2 });
});

test('changesIn counts down to UTC midnight', () => {
  assert.equal(changesIn(new Date('2026-09-22T14:46:00Z')), '09h 14m');
  assert.equal(changesIn(new Date('2026-09-22T00:00:00Z')), '24h 00m');
});

test('shelfFor picks a decade with enough films and rotates it by day', () => {
  const big = {};
  for (let i = 0; i < 8; i++) big[`t${i}`] = { i, t: `Twenties ${i}`, y: 1920 + i, p: '/p.jpg', v: 7, c: 1 };
  for (let i = 0; i < 8; i++) big[`f${i}`] = { i, t: `Forties ${i}`, y: 1940 + i, p: '/p.jpg', v: 7, c: 1 };
  big.lone = { i: 99, t: 'Only Sixties film', y: 1965, p: '/p.jpg', v: 9, c: 1 };
  for (let i = 0; i < 8; i++) big[`n${i}`] = { i, t: `Nineties ${i}`, y: 1990 + i, p: '/p.jpg', v: 9, c: 1 };
  const a = shelfFor(big, new Date('2026-09-22T12:00:00Z'));
  assert.equal(a.films.length, 6);
  assert.ok([1920, 1940].includes(a.decade), 'the lone 1960s film cannot fill a shelf, and the 1990s are too recent');
  assert.ok(a.films.every(f => Math.floor(f.entry.y / 10) * 10 === a.decade));
  const b = shelfFor(big, new Date('2026-09-23T12:00:00Z'));
  assert.notEqual(a.decade, b.decade);
  assert.equal(shelfFor(index), null, 'no decade in the small index has six films');
});
