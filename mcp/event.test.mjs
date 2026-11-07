// The collecting and reading endpoints (../api/event.js, ../api/stats.js) with Redis stubbed out
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.KV_REST_API_URL = 'https://redis.test';
process.env.KV_REST_API_TOKEN = 'write-token';
process.env.KV_REST_API_READ_ONLY_TOKEN = 'read-token';
process.env.STATS_TOKEN = 'a-long-enough-stats-token';
const { POST } = await import('../api/event.js');
const { GET, playingNow } = await import('../api/stats.js');

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const post = (body, headers = {}) => POST(new Request('https://site.test/api/event', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'user-agent': BROWSER, 'sec-fetch-site': 'same-origin', origin: 'https://site.test', 'cf-connecting-ip': '203.0.113.7', ...headers } }));

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
  // Where from and on what, as families, from what Cloudflare and the agent say
  assert.ok(calls[0].commands.some(c => c[0] === 'ZINCRBY' && c[1].startsWith('stats:systems:') && c[3] === 'iOS'));
  assert.ok(!calls[0].commands.some(c => c[1].startsWith('stats:countries:')), 'no country known, none counted');
});

test('the country Cloudflare saw is counted for a page view, as a code in its own board', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 60_000 }); // past the 30-second write buffer, so this write goes out
  const calls = stubRedis(t);
  const request = Object.assign(new Request('https://site.test/api/event', { method: 'POST', body: JSON.stringify({ name: 'Page view', data: { path: '/' } }),
    headers: { 'user-agent': BROWSER, 'sec-fetch-site': 'same-origin', origin: 'https://site.test', 'cf-connecting-ip': '203.0.113.8' } }), { cf: { country: 'IE' } });
  assert.equal((await POST(request)).status, 204);
  assert.ok(calls[0].commands.some(c => c[0] === 'ZINCRBY' && c[1].startsWith('stats:countries:') && c[3] === 'IE'));
});

test('what is playing now comes from the log: the last 15 minutes, one line per film, newest word first', () => {
  const now = Date.parse('2026-09-21T10:30:00Z');
  const at = minutesAgo => new Date(now - minutesAgo * 60_000).toISOString();
  const rows = playingNow([
    { at: at(1), name: 'Watched', data: { where: 'film', film: 'Cops1922', seconds: 300, total: 1500 } },
    { at: at(2), name: 'Search', data: { query: 'cops' } },
    { at: at(3), name: 'Reached', data: { film: 'Nosferatu', at: 4 } },
    { at: at(5), name: 'Play', data: { film: 'Cops1922', player: 'own' } },
    { at: at(6), name: 'TV', data: { action: 'tune', channel: 'atomic-age' } },
    { at: at(20), name: 'Play', data: { film: 'Metropolis', player: 'own' } },
  ], now);
  assert.deepEqual(rows, [{ at: at(1), film: 'Cops1922', minutes: 25 }, { at: at(3), film: 'Nosferatu', tenth: 4 }, { at: at(6), channel: 'atomic-age' }]);
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
  for (let i = 0; i < 62; i++) last = await post({ name: 'Load more', data: {} }, { 'cf-connecting-ip': '198.51.100.20' });
  assert.equal(last.status, 429);
});

test('a database failure is a 503, never an exception', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500 }));
  const later = Date.now() + 3600_000; // past the batch interval, so this event is the one that writes
  t.mock.method(Date, 'now', () => later);
  t.mock.method(console, 'error', () => {});
  assert.equal((await post({ name: 'Load more', data: {} }, { 'cf-connecting-ip': '198.51.100.21' })).status, 503);
});

test('stats need the secret, read with the read-only token, and come back shaped for the page', async t => {
  const get = (token) => GET(new Request('https://site.test/api/stats', { headers: token ? { authorization: `Bearer ${token}` } : {} }));
  const calls = stubRedis(t, commands => commands.map(c => ({ result: c[0] === 'HGETALL' ? ['Play', '3', 'Film opened', '9'] : c[0] === 'PFCOUNT' ? 12
    : c[0] === 'HMGET' ? c.slice(2).map(id => ({ Cops1922: 'Cops', Nosferatu: 'Nosferatu' }[id] ?? null))
    : c[0] === 'LRANGE' ? [JSON.stringify({ at: '2026-09-21T10:00:00.000Z', name: 'Play', data: { film: 'Cops1922' } }), 'not json']
    : ['Cops1922', '7', 'Nosferatu', '2'] })));
  assert.equal((await get()).status, 404);
  assert.equal((await get('wrong-token-of-same-len!!')).status, 404);
  assert.equal((await get('é'.repeat(25))).status, 404, 'same length in characters, not in bytes: a 404, never a 500');
  assert.equal(calls.length, 0, 'no database access without the secret');
  const response = await get('a-long-enough-stats-token');
  assert.equal(response.status, 200);
  // Redis counts PFCOUNT as a write (it caches its answer in the key), so the read-only token
  // may not run it: visitor counts go through the main token, everything else stays read-only
  const readOnly = calls.find(c => c.auth === 'Bearer read-token');
  const counting = calls.find(c => c.auth === 'Bearer write-token');
  assert.ok(readOnly.commands.every(c => ['HGETALL', 'ZREVRANGE', 'ZRANGE', 'ZMSCORE', 'LRANGE'].includes(c[0])));
  assert.ok(counting.commands.every(c => c[0] === 'PFCOUNT'));
  // The last count is the active-now window, after 13 monthly estimates
  assert.ok(counting.commands.at(-1)[1].startsWith('stats:online:'));
  assert.equal(counting.commands.filter(c => /^stats:visitors:\d{4}-\d{2}$/.test(c[1])).length, 14, '13 months, and this month again for the tile');
  const body = await response.json();
  assert.equal(body.days.length, 30);
  assert.equal(body.months.length, 13);
  assert.ok(body.months.every(m => /^\d{4}-\d{2}$/.test(m.month) && m.visitors === 12));
  assert.equal(body.months.at(-1).month, body.month);
  assert.deepEqual(body.playing, []);
  assert.deepEqual(body.visitHours, { Play: 3, 'Film opened': 9 }, 'the stubbed hash, read as pairs');
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

test('a page of the log needs a plain offset and comes back with its length and film names', async t => {
  const calls = stubRedis(t, commands => commands.map(c => ({ result: c[0] === 'LRANGE' ? [JSON.stringify({ at: '2026-09-21T10:00:00.000Z', name: 'Search', data: { query: 'noir', kind: 'typed' } }), JSON.stringify({ at: '2026-09-21T09:00:00.000Z', name: 'Play', data: { film: 'Cops1922', player: 'own' } })]
    : c[0] === 'LLEN' ? 7 : c[0] === 'HMGET' ? c.slice(2).map(id => ({ Cops1922: 'Cops' }[id] ?? null)) : null })));
  const get = (query) => GET(new Request(`https://site.test/api/stats${query}`, { headers: { authorization: 'Bearer a-long-enough-stats-token' } }));
  assert.equal((await get('?log=-1')).status, 400);
  assert.equal((await get('?log=abc')).status, 400);
  assert.equal((await get('?profile=../x')).status, 400);
  const body = await (await get('?log=500')).json();
  assert.deepEqual(calls[0].commands[0], ['LRANGE', 'stats:recent', 500, 999]);
  assert.equal(body.total, 7);
  assert.equal(body.rows.length, 2);
  assert.equal(body.rows[0].data.query, 'noir');
  assert.equal(body.titles.Cops1922, 'Cops');
});
