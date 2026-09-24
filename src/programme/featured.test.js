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

test('every front-page shelf is a real list with a button deeper, and every hour of the week has a lead', async () => {
  const { slots, westerns, eighties } = JSON.parse(readFileSync(new URL('./shelves.json', import.meta.url), 'utf8'));
  const { leadAt, shelfBesides, nextLead } = await import('../services/programme.js');
  const { readdirSync } = await import('node:fs');
  const slugs = readdirSync(new URL('../lists/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const shelves = [...slots.flatMap(s => s.shelves), westerns];
  for (const shelf of shelves) {
    assert.ok(slugs.includes(shelf.list), `${shelf.list} is not a list`);
    assert.ok(shelf.more.label && shelf.more.href.startsWith('/browse?'), `${shelf.list} needs a way deeper`);
  }
  assert.equal(new Set(shelves.map(s => s.list)).size, shelves.length, 'no list twice, and the westerns never lead');
  assert.ok(eighties.length > 1 && eighties.every(e => slugs.includes(e.list)));
  for (const e of eighties) assert.notEqual(shelfBesides(eighties, e.list).list, e.list, 'the 80s shelf is never the list leading');
  assert.notEqual(shelfBesides(eighties, null, new Date(2026, 8, 28, 12)).list, shelfBesides(eighties, null, new Date(2026, 8, 29, 12)).list, 'a different 80s list each day');

  // Local time, as the visitor's clock says it. 27 Sep 2026 is a Sunday.
  const at = (d, h, m = 0) => leadAt(slots, new Date(2026, 8, d, h, m));
  for (let h = 0; h < 7 * 24; h++) assert.ok(at(27 + Math.floor(h / 24), h % 24), `no lead at day ${Math.floor(h / 24)}, ${h % 24}:00`);
  assert.equal(at(30, 15).slot, 'Weekday afternoons', 'a Wednesday afternoon');
  assert.equal(at(30, 20).slot, 'Weeknight');
  assert.equal(at(32, 21).slot, '80s video store night', 'Friday night');
  assert.equal(at(33, 1).slot, '80s video store night', "1am Saturday is still Friday night");
  assert.equal(at(33, 11).slot, 'Saturday matinee');
  assert.equal(at(30, 23, 30).slot, 'Late night');
  assert.equal(at(28, 20).list, at(28, 21).list, 'the same list all evening');
  assert.notEqual(at(28, 20).list, at(29, 20).list, 'a different list the next weeknight');
  assert.notEqual(at(32, 21).list, at(39, 21).list, 'a different 80s list next Friday');
  const next = nextLead(slots, new Date(2026, 8, 30, 20, 15));
  assert.equal(next.at.getHours(), 23, 'a weeknight lead runs until late night');
  assert.equal(next.lead.slot, 'Late night');
});
