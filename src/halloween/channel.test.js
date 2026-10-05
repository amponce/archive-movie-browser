import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schedule, seasonalChannels, toChannelsM3U, toM3U, toXMLTV, CHANNELS } from '../../api/_tv.js';
import { FILMS } from './days.js';

const at = iso => Date.parse(iso);
const OCT_4 = at('2026-10-04T19:00:00Z');
// What every other channel looks like, to compare with and without the season
const others = data => JSON.stringify(data.channels.filter(c => c.id !== 'halloween'));

test('every film has a measured length, so the Halloween channel can air it', () => {
  const lineups = JSON.parse(readFileSync(new URL('../../public/tv-lineups.json', import.meta.url), 'utf8')).films;
  for (const film of FILMS) assert.ok(lineups[film], film);
});

test('the Halloween channel exists only in October, Pacific time', () => {
  assert.deepEqual(seasonalChannels(at('2026-10-01T06:59:00Z')), [], 'still September 30 in Los Angeles');
  assert.equal(seasonalChannels(at('2026-10-01T07:00:00Z')).length, 1);
  assert.equal(seasonalChannels(at('2026-11-01T06:59:00Z')).length, 1);
  assert.deepEqual(seasonalChannels(at('2026-11-01T07:00:00Z')), []);
  assert.ok(!schedule({ now: at('2026-09-24T20:00:00Z') }).channels.some(c => c.id === 'halloween'));
  assert.ok(!schedule({ now: at('2026-11-02T20:00:00Z') }).channels.some(c => c.id === 'halloween'));
});

test('it goes on the end, as HWN, and every other channel is as it was', () => {
  const data = schedule({ now: OCT_4 });
  const last = data.channels.at(-1);
  assert.equal(last.id, 'halloween');
  assert.equal(last.call, 'HWN');
  assert.equal(last.name, 'Halloween');
  assert.equal(last.number, CHANNELS.length + 1);
  assert.deepEqual(data.channels.slice(0, -1).map(c => c.number), data.channels.slice(0, -1).map(c => CHANNELS.find(x => x.id === c.id).number));
  assert.ok(data.channels.slice(0, -1).every(c => !('call' in c)));
  assert.equal(others(data), others(schedule({ now: OCT_4, seen: { [FILMS[0]]: 5 } })), 'counts change no other channel');
});

test('it airs the calendar in order, with its notes, and only films that may air', () => {
  const channel = schedule({ now: OCT_4 }).channels.at(-1);
  const ids = channel.lineup.map(f => f.id);
  assert.deepEqual(ids, FILMS.filter(id => ids.includes(id)), 'calendar order');
  assert.ok(ids.length >= 28, `${ids.length} films air`);
  const data = JSON.parse(readFileSync(new URL('./31-days.json', import.meta.url), 'utf8'));
  assert.equal(channel.lineup[0].note, data.days.find(d => d.film === ids[0]).note);
  assert.ok(channel.now && channel.programmes.length > 0);
});

test('on October 31 the most seen air first; without counts, calendar order', () => {
  const halloween = at('2026-10-31T19:00:00Z');
  const seen = { [FILMS[30]]: 40, [FILMS[5]]: 30, [FILMS[0]]: 20 };
  const finale = schedule({ now: halloween, seen }).channels.at(-1).lineup.map(f => f.id);
  assert.deepEqual(finale.slice(0, 3), [FILMS[30], FILMS[5], FILMS[0]]);
  const plain = schedule({ now: halloween }).channels.at(-1).lineup.map(f => f.id);
  assert.deepEqual(plain, FILMS.filter(id => plain.includes(id)));
  const before = schedule({ now: at('2026-10-30T19:00:00Z'), seen }).channels.at(-1).lineup.map(f => f.id);
  assert.deepEqual(before, plain, 'counts only reorder it on the day');
});

test('IPTV playlists and the guide carry it while it exists', () => {
  const data = schedule({ now: OCT_4, hours: 6 });
  const channels = toChannelsM3U(data);
  assert.match(channels, new RegExp(`tvg-id="halloween" tvg-chno="${CHANNELS.length + 1}" tvg-name="Halloween"`));
  assert.match(channels, /\/api\/tv\/live\/halloween\n/);
  assert.match(toM3U(data), /group-title="Halloween"/);
  assert.match(toXMLTV(data), /<channel id="halloween"><display-name>Halloween<\/display-name>/);
  assert.match(toXMLTV(data), /<programme [^>]*channel="halloween">/);
  assert.doesNotMatch(toChannelsM3U(schedule({ now: at('2026-11-02T20:00:00Z') })), /halloween/);
});
