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
