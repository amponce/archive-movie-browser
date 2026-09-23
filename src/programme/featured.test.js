import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Every hand-picked film must be one the front page can actually show
const picks = JSON.parse(readFileSync(new URL('./featured.json', import.meta.url), 'utf8')).films;
const index = JSON.parse(readFileSync(new URL('../../public/poster-index.json', import.meta.url), 'utf8')).films;

test('every featured pick is in the poster index with a poster and a line of why', () => {
  for (const pick of picks) {
    assert.ok(index[pick.id]?.p, `${pick.id} has no poster in the index`);
    assert.ok(!/trailer/i.test(pick.id), `${pick.id} is a trailer upload`);
    assert.ok(pick.why && pick.why.length > 20, `${pick.id} needs a why`);
  }
  assert.ok(picks.length >= 14, 'two weeks without a repeat');
});

test('every front-page shelf is a real list with a button that goes deeper', async () => {
  const { shelves } = JSON.parse(readFileSync(new URL('./shelves.json', import.meta.url), 'utf8'));
  const { shelfOfDay } = await import('../services/programme.js');
  const { readdirSync } = await import('node:fs');
  const slugs = readdirSync(new URL('../lists/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  for (const shelf of shelves) {
    assert.ok(slugs.includes(shelf.list), `${shelf.list} is not a list`);
    assert.ok(shelf.more.label && shelf.more.href.startsWith('/browse?'), `${shelf.list} needs a way deeper`);
  }
  assert.equal(new Set(shelves.map(s => s.list)).size, shelves.length, 'no list twice');
  // One a day, in order, wrapping round
  const day = new Date(Date.UTC(2026, 8, 22, 12));
  const next = new Date(day.getTime() + 86400000);
  const i = shelves.indexOf(shelfOfDay(shelves, day));
  assert.equal(shelfOfDay(shelves, next), shelves[(i + 1) % shelves.length]);
});
