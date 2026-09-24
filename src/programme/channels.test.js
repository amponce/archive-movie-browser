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
