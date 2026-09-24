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
  const { schedule, toChannelsM3U, liveStream, toXMLTV, CHANNELS } = await import('../../api/_tv.js');
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
  assert.equal(liveStream(data, first.id), first.now.film.url);
  assert.match(liveStream(data, first.id), /^https:\/\/archive\.org\/download\//);
  assert.equal(liveStream(data, 'no-such-channel'), null);
  assert.ok(CHANNELS.length >= entries.length);
});
