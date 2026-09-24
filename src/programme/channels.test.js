import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('every list is in the channel lineup once, with its own call sign of up to four letters', () => {
  const { lineup } = JSON.parse(readFileSync(new URL('./channels.json', import.meta.url), 'utf8'));
  const slugs = readdirSync(new URL('../lists/', import.meta.url)).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  const listed = lineup.map(([slug]) => slug);
  for (const slug of slugs) assert.ok(listed.includes(slug), `${slug} needs a place in the lineup`);
  for (const slug of listed) assert.ok(slugs.includes(slug), `${slug} is in the lineup but is not a list`);
  assert.equal(new Set(listed).size, listed.length, 'no channel twice');
  for (const [slug, call] of lineup) assert.match(call, /^[A-Z0-9]{2,4}$/, slug);
  assert.equal(new Set(lineup.map(([, call]) => call)).size, lineup.length, 'no two call signs alike');
});

test('channels are numbered by their place in the lineup', async () => {
  const { lineup } = JSON.parse(readFileSync(new URL('./channels.json', import.meta.url), 'utf8'));
  const { CHANNELS } = await import('../../api/_tv.js');
  assert.deepEqual(CHANNELS.map(c => c.id), lineup.map(([slug]) => slug));
  assert.deepEqual(CHANNELS.map(c => c.number), CHANNELS.map((_, i) => i + 1));
});

test('IPTV apps get one entry per channel, matched to the guide, each leading to what is on now', async () => {
  const { schedule, toChannelsM3U, liveStreams, toXMLTV, CHANNELS } = await import('../../api/_tv.js');
  const now = Date.UTC(2026, 8, 24, 20);
  const data = schedule({ now, hours: 1 });
  const m3u = toChannelsM3U(data);
  const entries = m3u.split('\n').filter(line => line.startsWith('#EXTINF'));
  assert.equal(entries.length, data.channels.length, 'one entry per channel, not per film');
  assert.equal(new Set(entries.map(e => e.match(/tvg-id="([^"]+)"/)[1])).size, entries.length);
  assert.match(m3u, /\nhttps:\/\/www\.orphanedfilms\.com\/api\/tv\/live\/kung-fu-theater\n/);
  const guideIds = [...toXMLTV(data).matchAll(/<channel id="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(entries.map(e => e.match(/tvg-id="([^"]+)"/)[1]), guideIds, 'the same ids, in the same order, as the guide');
  const first = data.channels[0];
  const streams = liveStreams(data, first.id);
  assert.equal(streams[0], first.now.film.url, 'the film on now first');
  assert.ok(streams.length > 1 && streams.length <= 4, 'then the next ones, in case a file has gone');
  assert.ok(streams.every(u => /^https:\/\/archive\.org\/download\//.test(u)));
  assert.deepEqual(liveStreams(data, 'no-such-channel'), []);
  assert.match(m3u.split('\n')[0], /^#EXTM3U x-tvg-url="https:\/\/www\.orphanedfilms\.com\/api\/tv\/guide\.xml"/, 'apps find the guide in the header');
  assert.match(toChannelsM3U(data, 'http://localhost:5183'), /\nhttp:\/\/localhost:5183\/api\/tv\/live\/kung-fu-theater\n/, 'addresses follow the site serving them');
  // Every programme: a title, then a description, then its genres, in the DTD's order
  const guide = toXMLTV(schedule({ now, hours: 72 }));
  const progs = [...guide.matchAll(/<programme [^>]*>(.*?)<\/programme>/g)].map(m => m[1]);
  assert.ok(progs.length > 44 * 3);
  for (const p of progs) assert.match(p, /^<title>[^<]+<\/title><desc>[^<]+<\/desc>(<date>\d{4}<\/date>)?(<category lang="en">[^<]+<\/category>)*<length units="minutes">\d+<\/length>/);
  assert.ok(progs.some(p => p.includes('Yuen Woo-ping')), 'a hand-picked list note becomes the description');
  assert.ok(CHANNELS.length >= entries.length);
});
