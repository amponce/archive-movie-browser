import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { handle } from '../../api/community.js';

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
