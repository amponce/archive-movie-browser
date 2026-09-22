// The collecting and reading endpoints (../api/event.js, ../api/stats.js) with Redis stubbed out
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.KV_REST_API_URL = 'https://redis.test';
process.env.KV_REST_API_TOKEN = 'write-token';
process.env.KV_REST_API_READ_ONLY_TOKEN = 'read-token';
process.env.STATS_TOKEN = 'a-long-enough-stats-token';
const { POST } = await import('../api/event.js');
const { GET } = await import('../api/stats.js');

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const post = (body, headers = {}) => POST(new Request('https://site.test/api/event', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'user-agent': BROWSER, 'sec-fetch-site': 'same-origin', origin: 'https://site.test', 'x-forwarded-for': '203.0.113.7', ...headers } }));

function stubRedis(t, reply = (commands) => commands.map(() => ({ result: 1 }))) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url, auth: init.headers.Authorization, commands: JSON.parse(init.body) }); return { ok: true, json: async () => reply(JSON.parse(init.body)) }; });
  return calls;
}

test('a valid event from our own page is counted, with the write token, and nothing personal is stored', async t => {
  const calls = stubRedis(t);
  assert.equal((await post({ name: 'Page view', data: { path: '/', referrer: 'news.ycombinator.com' } })).status, 204);
  assert.equal(calls[0].url, 'https://redis.test/pipeline');
  assert.equal(calls[0].auth, 'Bearer write-token');
  assert.ok(calls[0].commands.some(c => c[0] === 'PFADD'));
  assert.ok(!JSON.stringify(calls[0].commands).includes('203.0.113.7') && !JSON.stringify(calls[0].commands).includes('iPhone'));
});

test('other sites, bots, junk and made-up events are turned away before the database', async t => {
  const calls = stubRedis(t);
  assert.equal((await post({ name: 'Play', data: { film: 'Cops1922', player: 'own' } }, { 'sec-fetch-site': 'cross-site', origin: 'https://evil.test' })).status, 403);
  assert.equal((await post({ name: 'Play', data: { film: 'Cops1922', player: 'own' } }, { origin: 'https://evil.test', 'sec-fetch-site': '' })).status, 403);
  assert.equal((await post({ name: 'Play', data: { film: 'Cops1922', player: 'own' } }, { 'user-agent': 'Googlebot/2.1' })).status, 204);
  assert.equal((await post('not json')).status, 400);
  assert.equal((await post({ name: 'Made up', data: {} })).status, 400);
  assert.equal(calls.length, 0);
});

test('a malformed Origin (null, or not a URL) is refused with 403, never a 500', async t => {
  const calls = stubRedis(t);
  for (const origin of ['null', 'not a url', 'javascript:alert(1)']) {
    assert.equal((await post({ name: 'Load more', data: {} }, { origin, 'sec-fetch-site': '' })).status, 403, origin);
  }
  assert.equal(calls.length, 0);
});

test('one address cannot flood the counters', async t => {
  stubRedis(t);
  let last;
  for (let i = 0; i < 62; i++) last = await post({ name: 'Load more', data: {} }, { 'x-forwarded-for': '198.51.100.20' });
  assert.equal(last.status, 429);
});

test('a database failure is a 503, never an exception', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500 }));
  t.mock.method(console, 'error', () => {});
  assert.equal((await post({ name: 'Load more', data: {} }, { 'x-forwarded-for': '198.51.100.21' })).status, 503);
});

test('stats need the secret, read with the read-only token, and come back shaped for the page', async t => {
  const get = (token) => GET(new Request('https://site.test/api/stats', { headers: token ? { authorization: `Bearer ${token}` } : {} }));
  const calls = stubRedis(t, commands => commands.map(c => ({ result: c[0] === 'HGETALL' ? ['Play', '3', 'Film opened', '9'] : c[0] === 'PFCOUNT' ? 12
    : c[0] === 'HMGET' ? c.slice(2).map(id => ({ Cops1922: 'Cops', Nosferatu: 'Nosferatu' }[id] ?? null))
    : c[0] === 'LRANGE' ? [JSON.stringify({ at: '2026-09-21T10:00:00.000Z', name: 'Play', data: { film: 'Cops1922' } }), 'not json']
    : ['Cops1922', '7', 'Nosferatu', '2'] })));
  assert.equal((await get()).status, 404);
  assert.equal((await get('wrong-token-of-same-len!!')).status, 404);
  assert.equal(calls.length, 0, 'no database access without the secret');
  const response = await get('a-long-enough-stats-token');
  assert.equal(response.status, 200);
  // Redis counts PFCOUNT as a write (it caches its answer in the key), so the read-only token
  // may not run it: visitor counts go through the main token, everything else stays read-only
  const readOnly = calls.find(c => c.auth === 'Bearer read-token');
  const counting = calls.find(c => c.auth === 'Bearer write-token');
  assert.ok(readOnly.commands.every(c => ['HGETALL', 'ZREVRANGE', 'LRANGE'].includes(c[0])));
  assert.ok(counting.commands.every(c => c[0] === 'PFCOUNT'));
  const body = await response.json();
  assert.equal(body.days.length, 30);
  assert.deepEqual(body.days.at(-1).events, { Play: 3, 'Film opened': 9 });
  assert.equal(body.days.at(-1).visitors, 12);
  assert.deepEqual(body.boards.played[0], ['Cops1922', 7]);
  // Titles for the films on the boards, and the latest events, newest first
  const lookups = calls.filter(c => c.commands.some(cmd => cmd[0] === 'HMGET'));
  assert.equal(lookups.length, 1);
  assert.ok(lookups[0].commands[0].includes('Cops1922') && lookups[0].commands[0].includes('Nosferatu'));
  assert.deepEqual(body.titles, { Cops1922: 'Cops', Nosferatu: 'Nosferatu' });
  assert.deepEqual(body.recent[0], { at: '2026-09-21T10:00:00.000Z', name: 'Play', data: { film: 'Cops1922' } });
});

test('an error from the database is an error, not a silent zero', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => ({ ok: true, json: async () => JSON.parse(init.body).map(() => ({ error: 'NOPERM this user has no permissions' })) }));
  const { redis } = await import('../api/_redis.js');
  await assert.rejects(() => redis([['PFCOUNT', 'x']]), /NOPERM/);
});
