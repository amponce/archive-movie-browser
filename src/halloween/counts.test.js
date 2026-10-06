import test from 'node:test';
import assert from 'node:assert/strict';
import { validEvent, commandsFor } from '../../api/_stats.js';
import handler from '../../api/halloween.js';
import { route } from '../../api/_routes.js';
import { FILMS } from './days.js';

const VISIT = '0123456789abcdef';

test("'Seen' is accepted for the 31 films only, and counts distinct visits", () => {
  const event = validEvent({ name: 'Seen', data: { film: FILMS[3] }, visit: VISIT });
  assert.deepEqual(event, { name: 'Seen', data: { film: FILMS[3] }, visit: VISIT });
  const commands = commandsFor(event, { now: new Date('2026-10-04T19:00:00Z') });
  assert.ok(commands.some(c => c.join(' ') === `PFADD stats:halloween:seen:${FILMS[3]} ${VISIT}`));
  assert.ok(commands.some(c => c.join(' ') === `PFADD stats:halloween:seen-any ${VISIT}`));
  for (const film of ['Detour', '', undefined, 'x'.repeat(300)]) assert.equal(validEvent({ name: 'Seen', data: { film } }), null, String(film));
  assert.ok(!commandsFor(validEvent({ name: 'Seen', data: { film: FILMS[0] } })).some(c => c[0] === 'PFADD'), 'nothing to count without a visit');
});

// GET /api/halloween against a stubbed stats database
async function get(answer) {
  const real = globalThis.fetch;
  const env = { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  process.env.KV_REST_API_URL = 'https://redis.test';
  process.env.KV_REST_API_TOKEN = 'token';
  let sent;
  globalThis.fetch = async (url, init) => { sent = JSON.parse(init.body); return answer(sent); };
  const res = { status: 200, headers: {}, body: null };
  const out = {
    status(code) { res.status = code; return out; },
    setHeader(key, value) { res.headers[key] = value; return out; },
    json(value) { res.body = value; },
    end() {},
  };
  try {
    await handler({ method: 'GET', query: {}, headers: {} }, out);
  } finally {
    globalThis.fetch = real;
    if (env.url === undefined) delete process.env.KV_REST_API_URL; else process.env.KV_REST_API_URL = env.url;
    if (env.token === undefined) delete process.env.KV_REST_API_TOKEN; else process.env.KV_REST_API_TOKEN = env.token;
  }
  return { ...res, sent };
}

test('/api/halloween answers seen counts per film and the people who ticked anything', async () => {
  const res = await get(commands => ({ ok: true, json: async () => commands.map((_, i) => ({ result: i === commands.length - 1 ? 12 : i })) }));
  assert.equal(res.status, 200);
  assert.equal(res.headers['Cache-Control'], 'public, s-maxage=300');
  assert.deepEqual(Object.keys(res.body), ['seen', 'people']);
  assert.equal(res.body.people, 12);
  assert.deepEqual(Object.keys(res.body.seen), FILMS);
  assert.equal(res.body.seen[FILMS[2]], 2);
  assert.ok(res.sent.every(c => c[0] === 'PFCOUNT'), 'reads only');
  assert.deepEqual(route('/api/halloween'), { name: 'halloween', query: {} });
});

test('/api/halloween says so, uncached, when the stats database is down', async () => {
  const res = await get(() => ({ ok: false, status: 500 }));
  assert.equal(res.status, 503);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
