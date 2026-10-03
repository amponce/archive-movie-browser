import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/tmdb.js';

test('/api/tmdb allows 600 lookups a minute per address, then answers 429', async t => {
  process.env.TMDB_API_KEY = 'test';
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  const statuses = [];
  for (let i = 0; i < 601; i++) {
    let code;
    const res = { setHeader() {}, status(c) { code = c; return this; }, json() {}, end() {} };
    await handler({ method: 'GET', query: { path: 'genre/movie/list' }, headers: { 'cf-connecting-ip': '203.0.113.9' } }, res);
    statuses.push(code);
  }
  assert.equal(statuses.filter(c => c === 200).length, 600);
  assert.equal(statuses[600], 429);
});
