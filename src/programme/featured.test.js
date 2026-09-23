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

test('every front-page shelf is a real list with a button that goes deeper, and the rotation is weekly', async () => {
  const { categories } = JSON.parse(readFileSync(new URL('./shelves.json', import.meta.url), 'utf8'));
  const { shelfOfDay } = await import('../services/programme.js');
  const { readdirSync } = await import('node:fs');
  const slugs = readdirSync(new URL('../lists/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const shelves = categories.flatMap(c => c.shelves);
  for (const shelf of shelves) {
    assert.ok(slugs.includes(shelf.list), `${shelf.list} is not a list`);
    assert.ok(shelf.more.label && shelf.more.href.startsWith('/browse?'), `${shelf.list} needs a way deeper`);
  }
  assert.equal(new Set(shelves.map(s => s.list)).size, shelves.length, 'no list twice');

  const at = (y, m, d) => shelfOfDay(categories, new Date(Date.UTC(y, m - 1, d, 12)));
  // The week of 21 September 2026 is westerns, the next one cult 80s
  assert.equal(at(2026, 9, 21).category, 'Westerns');
  assert.equal(at(2026, 9, 27).category, 'Westerns');
  assert.equal(at(2026, 9, 28).category, 'Cult 80s');
  // A different list on consecutive days of a week with more than one
  assert.notEqual(at(2026, 9, 28).list, at(2026, 9, 29).list);
  // After the last category it starts again
  assert.equal(at(2026, 9, 21 + 7 * categories.length).category, 'Westerns');
});
