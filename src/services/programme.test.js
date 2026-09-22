import test from 'node:test';
import assert from 'node:assert/strict';
import { featuredFor, rowFor, revealsFrom } from './programme.js';

const index = {
  loved_unseen: { i: 1, t: 'Messiah of Evil', y: 1975, p: '/a.jpg', v: 7.9, c: 0.95, g: ['Horror'] },
  popular: { i: 2, t: 'Night of the Living Dead', y: 1968, p: '/b.jpg', v: 7.6, c: 1, g: ['Horror'] },
  shaky: { i: 3, t: 'Something', y: 1980, p: '/c.jpg', v: 9.9, c: 0.72, g: ['Horror'] },
  no_poster: { n: 1, c: 0.9 },
  western: { i: 4, t: 'The Bat', y: 1926, p: '/d.jpg', v: 6.1, c: 0.9, g: ['Western'] },
  renamed: { i: 5, t: 'Sherlock Jr.', y: 1924, p: '/e.jpg', v: 8.0, c: 1, g: ['Comedy'], u: 'MyMovie_20190318' },
};

test('featuredFor picks a confident, well-rated film with a poster, and changes with the day', () => {
  const a = featuredFor(index, new Date('2026-09-22T12:00:00Z'));
  assert.ok(['loved_unseen', 'popular', 'renamed'].includes(a.id), a.id);
  assert.ok(a.entry.c >= 0.8 && a.entry.p, 'never a shaky match or a missing poster');
  const days = new Set(Array.from({ length: 10 }, (_, i) => featuredFor(index, new Date(Date.UTC(2026, 8, 22 + i))).id));
  assert.ok(days.size > 1, 'a different film on different days');
  assert.equal(featuredFor(index, new Date('2026-09-22T12:00:00Z')).id, a.id, 'the same film all day');
});

test('rowFor returns the best films matching a genre and decade, poster and confidence required', () => {
  const row = rowFor(index, { genre: 'Horror', decade: 1960 });
  assert.deepEqual(row.map(f => f.id), ['popular']);
  assert.deepEqual(rowFor(index, { genre: 'Horror' }).map(f => f.id), ['loved_unseen', 'popular'], 'rated order, shaky left out');
  assert.deepEqual(rowFor(index, { genre: 'Documentary' }), []);
});

test('revealsFrom lists films the index identified under a different name', () => {
  assert.deepEqual(revealsFrom(index).map(f => f.id), ['renamed']);
});
