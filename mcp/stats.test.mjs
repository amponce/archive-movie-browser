// Rules for our own usage counts (../api/_stats.js). Lives here because `npm test --prefix mcp`
// is where the server-side code is tested.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validEvent, commandsFor, isBot, visitorToken } from '../api/_stats.js';

test('only known events with well-formed data are accepted', () => {
  assert.deepEqual(validEvent({ name: 'Play', data: { film: 'Cops1922', player: 'own', extra: 'x' } }), { name: 'Play', data: { film: 'Cops1922', player: 'own' } });
  assert.equal(validEvent({ name: 'Play', data: { film: 'Cops1922', player: 'vlc' } }), null);
  assert.equal(validEvent({ name: 'Film opened', data: { film: '../../etc/passwd' } }), null);
  assert.equal(validEvent({ name: 'Made up', data: {} }), null);
  assert.equal(validEvent(null), null);
  assert.deepEqual(validEvent({ name: 'Search', data: { query: '  Buster KEATON\n' + 'x'.repeat(200) } }).data.query.length, 60);
  assert.deepEqual(validEvent({ name: 'Filter', data: { type: 'decade', value: 1980 } }), { name: 'Filter', data: { type: 'decade', value: '1980' } });
  assert.equal(validEvent({ name: 'Filter', data: { type: 'evil', value: 'x' } }), null);
});

test('an event bumps the day total and its own leaderboard, and every key expires', () => {
  const now = new Date('2026-09-21T23:59:00Z');
  const commands = commandsFor(validEvent({ name: 'Play', data: { film: 'Cops1922', player: 'own' } }), { now });
  assert.deepEqual(commands.slice(0, 3), [
    ['HINCRBY', 'stats:day:2026-09-21', 'Play', 1],
    ['ZINCRBY', 'stats:played:2026-09', 1, 'Cops1922'],
    ['ZINCRBY', 'stats:players:2026-09', 1, 'own'],
  ]);
  const keys = new Set(commands.filter(c => c[0] !== 'EXPIRE').map(c => c[1]));
  assert.deepEqual(new Set(commands.filter(c => c[0] === 'EXPIRE').map(c => c[1])), keys);
});

test('searches are counted by text, pasted links are only counted', () => {
  const keysOf = (event) => commandsFor(validEvent(event), { now: new Date('2026-09-21T00:00:00Z') }).filter(c => c[0] === 'ZINCRBY');
  assert.deepEqual(keysOf({ name: 'Search', data: { query: 'Kung Fu', kind: 'typed' } }), [['ZINCRBY', 'stats:searches:2026-09', 1, 'kung fu']]);
  assert.deepEqual(keysOf({ name: 'Search', data: { kind: 'pasted link' } }), []);
});

test('visitors are estimated without storing who they are', async () => {
  const token = await visitorToken('203.0.113.9', 'Mozilla/5.0', '2026-09-21');
  assert.match(token, /^[0-9a-f]{24}$/);
  assert.equal(token, await visitorToken('203.0.113.9', 'Mozilla/5.0', '2026-09-21'), 'same person, same day: counted once');
  assert.notEqual(token, await visitorToken('203.0.113.9', 'Mozilla/5.0', '2026-09-22'), 'a new day gives a new token, so days cannot be linked');
  const commands = commandsFor(validEvent({ name: 'Page view', data: { path: '/', referrer: 'news.ycombinator.com' } }), { now: new Date('2026-09-21T10:00:00Z'), visitor: token });
  assert.ok(commands.some(c => c[0] === 'PFADD' && c[1] === 'stats:visitors:2026-09-21'));
  assert.ok(commands.some(c => c[0] === 'ZINCRBY' && c[1] === 'stats:referrers:2026-09' && c[3] === 'news.ycombinator.com'));
  assert.ok(!JSON.stringify(commands).includes('203.0.113.9'));
});

test('bots and empty user agents are not counted', () => {
  assert.equal(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBot(''), true);
  assert.equal(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'), false);
});

test('an opened film remembers its title, so the stats page can show names instead of identifiers', () => {
  const event = validEvent({ name: 'Film opened', data: { film: 'publicmovies212', title: '  A Boy and His Dog\n' + 'x'.repeat(200) } });
  assert.equal(event.data.title.length, 80);
  const commands = commandsFor(event, { now: new Date('2026-09-21T10:00:00Z') });
  assert.deepEqual(commands.find(c => c[0] === 'HSET'), ['HSET', 'stats:titles', 'publicmovies212', event.data.title]);
  // The leaderboard is still keyed by identifier: titles are not unique
  assert.ok(commands.some(c => c[0] === 'ZINCRBY' && c[3] === 'publicmovies212'));
  assert.ok(!commandsFor(validEvent({ name: 'Film opened', data: { film: 'Cops1922' } })).some(c => c[0] === 'HSET'), 'no title, nothing stored');
});

test('every event lands on a short "latest events" feed: what happened and when, never who', () => {
  const now = new Date('2026-09-21T10:00:00Z');
  const commands = commandsFor(validEvent({ name: 'Play', data: { film: 'Cops1922', player: 'own' } }), { now, visitor: 'abc123' });
  const push = commands.find(c => c[0] === 'LPUSH');
  assert.equal(push[1], 'stats:recent');
  assert.deepEqual(JSON.parse(push[2]), { at: '2026-09-21T10:00:00.000Z', name: 'Play', data: { film: 'Cops1922', player: 'own' } });
  assert.deepEqual(commands.find(c => c[0] === 'LTRIM'), ['LTRIM', 'stats:recent', 0, 49]);
  assert.ok(!push[2].includes('abc123'));
});
