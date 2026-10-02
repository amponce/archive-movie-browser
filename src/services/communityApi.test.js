import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { handle, addressKey } from '../../api/community.js';

const ORIGIN = 'https://www.orphanedfilms.com';
const ctx = async () => ({ db: await openTestDb(), flag: async () => false, minutes: async () => ({}), now: 1_700_000_000_000 });
const call = (c, method, path, { body, auth, ip = '1.1.1.1' } = {}) => handle(new Request(ORIGIN + path, {
  method, body: body && JSON.stringify(body),
  headers: { 'content-type': 'application/json', origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': ip, ...(auth && { authorization: `Bearer ${auth.id}.${auth.key}` }) },
}), c);

test('full flow: profile, favourite, channel, read by anyone, owner-only edit', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  assert.equal((await call(c, 'PUT', `/api/profile/${me.id}/favourites/Detour`, { auth: me })).status, 204);
  const res = await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'Night', films: [{ film: 'Detour', note: 'go' }] } });
  assert.equal(res.status, 201);
  const { id } = await res.json();
  const read = await (await call(c, 'GET', `/api/channel/${id}`)).json();
  assert.equal(read.name, 'Night');
  assert.equal(read.films[0].note, 'go');
  assert.equal(read.profileId, undefined, 'owner id is not exposed');
  const other = await (await call(c, 'POST', '/api/profile', { ip: '2.2.2.2' })).json();
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: other, body: { name: 'x' } })).status, 404);
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: { id: me.id, key: 'bad' }, body: { name: 'x' } })).status, 401);
});

test('writes from another site are refused', async () => {
  const c = await ctx();
  const res = await handle(new Request(`${ORIGIN}/api/profile`, { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }), c);
  assert.equal(res.status, 403);
});

test('profile creation is rate limited per address', async () => {
  const c = await ctx();
  for (let i = 0; i < 5; i++) assert.equal((await call(c, 'POST', '/api/profile', { ip: '9.9.9.9' })).status, 201);
  assert.equal((await call(c, 'POST', '/api/profile', { ip: '9.9.9.9' })).status, 429);
});

test('unlisted reads say noindex; listing is public and cacheable', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'N', films: [] } })).json();
  const res = await call(c, 'GET', `/api/channel/${id}`);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const list = await call(c, 'GET', '/api/channels');
  assert.match(list.headers.get('cache-control'), /s-maxage=60/);
});

test('submit reports the problem', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'N', films: [{ film: 'a' }] } })).json();
  const res = await call(c, 'POST', `/api/channel/${id}/submit`, { auth: me });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).problem, 'not-agreed');
});

test('oversized bodies and unknown routes', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  assert.equal((await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'x'.repeat(30_000) } })).status, 413);
  assert.equal((await call(c, 'GET', '/api/channel/not-an-id')).status, 404);
  assert.equal((await call(c, 'DELETE', '/api/channels')).status, 405);
});

test('a malformed film address is a 400, not an error', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  assert.equal((await call(c, 'PUT', `/api/profile/${me.id}/favourites/%E0%A4%A`, { auth: me })).status, 400);
});

test('a declared oversized body is refused before reading', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const res = await handle(new Request(ORIGIN + '/api/channel', { method: 'POST', body: '{}', headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'content-length': '30000', authorization: `Bearer ${me.id}.${me.key}` } }), c);
  assert.equal(res.status, 413);
});

test('any write clears expired limit rows', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  await c.db.prepare("INSERT INTO limits (bucket, count, until) VALUES ('old', 1, 5)").run();
  await call(c, 'PUT', `/api/profile/${me.id}/favourites/Detour`, { auth: me });
  assert.equal(await c.db.prepare("SELECT 1 AS n FROM limits WHERE bucket = 'old'").first(), null);
});

test('limit rows never hold the address, and still limit', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile', { ip: '203.0.113.7' })).json();
  assert.equal((await call(c, 'PUT', `/api/profile/${me.id}/favourites/Detour`, { auth: me, ip: '203.0.113.7' })).status, 204);
  const buckets = (await c.db.prepare('SELECT bucket FROM limits').all()).results.map(r => r.bucket);
  assert.deepEqual(buckets.map(b => b[0]).sort(), ['p', 'w']);
  for (const b of buckets) {
    assert.match(b, /^[pw]:[0-9a-f]{16}$/);
    assert.ok(!b.includes('203.0.113.7'));
  }
  for (let i = 0; i < 4; i++) await call(c, 'POST', '/api/profile', { ip: '203.0.113.7' });
  assert.equal((await call(c, 'POST', '/api/profile', { ip: '203.0.113.7' })).status, 429);
  assert.equal((await call(c, 'POST', '/api/profile', { ip: '203.0.113.8' })).status, 201, 'another address has its own count');
});

test('the address key changes with the day', async () => {
  const day = 86_400_000;
  assert.equal(await addressKey('203.0.113.7', 0), await addressKey('203.0.113.7', day - 1));
  assert.notEqual(await addressKey('203.0.113.7', 0), await addressKey('203.0.113.7', day));
  assert.notEqual(await addressKey('203.0.113.7', 0), await addressKey('203.0.113.8', 0));
});

test('an internal failure is a plain 500', async () => {
  const c = await ctx();
  const quiet = console.error; console.error = () => {};
  const res = await handle(new Request(ORIGIN + '/api/channels'), { ...c, db: {} });
  console.error = quiet;
  assert.equal(res.status, 500);
});

test('a channel read says who owns it only to the owner', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'Night', films: [{ film: 'Detour' }] } })).json();
  const other = await (await call(c, 'POST', '/api/profile', { ip: '2.2.2.2' })).json();
  assert.equal((await (await call(c, 'GET', `/api/channel/${id}`, { auth: me })).json()).ownerId, me.id);
  assert.equal((await (await call(c, 'GET', `/api/channel/${id}`)).json()).ownerId, undefined);
  assert.equal((await (await call(c, 'GET', `/api/channel/${id}`, { auth: other })).json()).ownerId, undefined);
  assert.equal((await (await call(c, 'GET', `/api/channel/${id}`, { auth: { id: me.id, key: 'f'.repeat(64) } })).json()).ownerId, undefined);
});

test('a film the filter refuses is a 400 as a favourite', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  assert.equal((await call(c, 'PUT', `/api/profile/${me.id}/favourites/test_snuff-film.upload`, { auth: me })).status, 400);
});

test('a listed channel holding a flagged film is noindex', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'N', films: [{ film: 'a' }] } })).json();
  await c.db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  assert.equal((await call(c, 'GET', `/api/channel/${id}`)).headers.get('x-robots-tag'), null);
  await c.db.prepare('UPDATE channel_films SET flagged = 1 WHERE channel_id = ?').bind(id).run();
  assert.equal((await call(c, 'GET', `/api/channel/${id}`)).headers.get('x-robots-tag'), 'noindex');
});
