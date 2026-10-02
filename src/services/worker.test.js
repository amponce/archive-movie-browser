import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';

test('the channel listing is cached under its bare path', async () => {
  const keys = [];
  const store = new Map();
  globalThis.caches = { default: {
    match: async (req) => { keys.push(['match', req.url]); return store.get(req.url)?.clone(); },
    put: async (req, res) => { keys.push(['put', req.url]); store.set(req.url, res); },
  } };
  const { default: worker } = await import('../../worker.js');
  const env = { DB: await openTestDb() };
  const waits = [];
  const ctx = { waitUntil: p => waits.push(p) };
  const first = await worker.fetch(new Request('https://www.orphanedfilms.com/api/channels?x=1'), env, ctx);
  await Promise.all(waits);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { channels: [] });
  assert.equal(first.headers.get('X-Content-Type-Options'), 'nosniff');
  const second = await worker.fetch(new Request('https://www.orphanedfilms.com/api/channels?y=2'), env, ctx);
  assert.equal(second.status, 200);
  assert.deepEqual(keys, [
    ['match', 'https://www.orphanedfilms.com/api/channels'],
    ['put', 'https://www.orphanedfilms.com/api/channels'],
    ['match', 'https://www.orphanedfilms.com/api/channels'],
  ]);
});
