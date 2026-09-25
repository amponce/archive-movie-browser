import test from 'node:test';
import assert from 'node:assert/strict';
import { validEvent, commandsFor, statsDay } from '../../api/_stats.js';

test('TV events are accepted and counted per channel', () => {
  const tune = validEvent({ name: 'TV', data: { action: 'tune', channel: 'atomic-age' } });
  assert.deepEqual(tune, { name: 'TV', data: { action: 'tune', channel: 'atomic-age' } });
  const keys = commandsFor(tune, { now: new Date('2026-09-23T12:00:00Z') }).filter(c => c[0] === 'ZINCRBY').map(c => `${c[1]} ${c[3]}`);
  assert.deepEqual(keys, ['stats:tv:2026-09 tune', 'stats:tuned:2026-09 atomic-age']);

  const watched = validEvent({ name: 'TV', data: { action: 'watched 10 minutes', channel: 'mine', film: 'hellhole.-1985' } });
  assert.ok(commandsFor(watched).some(c => c[1].startsWith('stats:stayed:') && c[3] === 'mine'));

  // Adding a film carries the film, not a channel
  assert.ok(validEvent({ name: 'TV', data: { action: 'add to my channel', film: 'hellhole.-1985' } }));
});

test('TV events with an unknown action or a malformed channel are refused', () => {
  assert.equal(validEvent({ name: 'TV', data: { action: 'hack', channel: 'atomic-age' } }), null);
  assert.equal(validEvent({ name: 'TV', data: { action: 'tune', channel: 'Atomic Age!<script>' } }), null);
});

const NOW = { now: new Date('2026-09-23T12:00:00Z') };
const cmds = (event, visit) => commandsFor(validEvent({ ...event, visit }), NOW);

test('minutes watched are counted per film, per channel and per day, from the seconds played', () => {
  const film = cmds({ name: 'Watched', data: { where: 'film', film: 'angel_and_the_badman', seconds: 120, total: 120 } });
  assert.ok(film.some(c => c.join(' ') === 'ZINCRBY stats:minutes:2026-09 2 angel_and_the_badman'));
  assert.ok(film.some(c => c.join(' ') === 'HINCRBY stats:day:2026-09-23 Seconds watched 120'));
  const tv = cmds({ name: 'Watched', data: { where: 'tv', channel: 'atomic-age', seconds: 90, total: 900 } });
  assert.ok(tv.some(c => c.join(' ') === 'ZINCRBY stats:channel-minutes:2026-09 1.5 atomic-age'));
  assert.equal(validEvent({ name: 'Watched', data: { where: 'film', film: 'x', seconds: 999999 } }), null, 'more than four hours at once is not a viewing');
  assert.equal(validEvent({ name: 'Watched', data: { where: 'elsewhere', seconds: 60 } }), null);
});

test('clicks are counted by what was clicked', () => {
  const click = cmds({ name: 'Click', data: { target: 'shelf-poster', film: 'angel_and_the_badman' } });
  assert.ok(click.some(c => c.join(' ') === 'ZINCRBY stats:clicks:2026-09 1 shelf-poster'));
  assert.equal(validEvent({ name: 'Click', data: { target: 'Not A Slug!' } }), null);
});

test('the funnel counts visits, not events, and keeps no visit ids anywhere else', () => {
  const visit = 'a1b2c3d4e5f60718';
  const stage = (event) => cmds(event, visit).filter(c => c[0] === 'PFADD').map(c => c[1]);
  assert.deepEqual(stage({ name: 'Page view', data: { path: '/' } }), ['stats:funnel:visited:2026-09-23']);
  assert.deepEqual(stage({ name: 'Click', data: { target: 'tv-tune-in' } }), ['stats:funnel:clicked:2026-09-23']);
  assert.deepEqual(stage({ name: 'Play', data: { film: 'x', player: 'own' } }), ['stats:funnel:played:2026-09-23']);
  assert.deepEqual(stage({ name: 'TV', data: { action: 'tune', channel: 'atomic-age' } }), ['stats:funnel:tuned in:2026-09-23'], 'surfing channels is not pressing play on a film');
  // A viewing moves the visit through every threshold its running total has passed
  assert.deepEqual(stage({ name: 'Watched', data: { where: 'film', film: 'x', seconds: 60, total: 700 } }),
    ['stats:funnel:watched 1+ min:2026-09-23', 'stats:funnel:watched 10+ min:2026-09-23']);
  // The id only ever goes into a HyperLogLog, never into the recent-events list
  const all = cmds({ name: 'Click', data: { target: 'spin' } }, visit);
  assert.ok(all.filter(c => c[0] !== 'PFADD').every(c => !JSON.stringify(c).includes(visit)));
  // A malformed id is ignored, the event still counts
  assert.ok(validEvent({ name: 'Click', data: { target: 'spin' }, visit: 'nope' }));
  assert.equal(cmds({ name: 'Click', data: { target: 'spin' } }, 'nope').filter(c => c[0] === 'PFADD').length, 0);
});

test('a day is a Pacific day: 5 PM in California is still that day, not tomorrow in UTC', () => {
  assert.equal(statsDay(new Date('2026-09-25T05:00:00Z')), '2026-09-24'); // 10 PM PDT
  assert.equal(statsDay(new Date('2026-09-25T07:00:00Z')), '2026-09-25'); // midnight PDT
  assert.equal(statsDay(new Date('2026-12-25T07:59:00Z')), '2026-12-24'); // 11:59 PM PST
  assert.ok(commandsFor({ name: 'Page view', data: { path: '/' } }, { now: new Date('2026-09-25T05:00:00Z'), visitor: 'v' }).some(c => c.join(' ') === 'PFADD stats:visitors:2026-09-24 v'));
});

test('a pasted link is counted without the link, and a refused search without its words', () => {
  assert.deepEqual(validEvent({ name: 'Search', data: { query: 'https://archive.org/details/@someone', kind: 'pasted link' } }).data, { query: '', kind: 'pasted link' });
  assert.equal(validEvent({ name: 'Search', data: { query: 'snuff film', kind: 'typed' } }).data.query, '');
  assert.equal(validEvent({ name: 'Search', data: { query: 'Night of the Living Dead', kind: 'typed' } }).data.query, 'night of the living dead');
});
