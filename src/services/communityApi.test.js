import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { handle, addressKey, LOOKUPS } from '../../api/community.js';
import { fakeWebauthn, resp } from './fakeWebauthn.js';

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

test('Archive.org lookups from one address are capped per hour; past it new films are stored flagged', async () => {
  const c = await ctx();
  let asked = 0;
  c.flag = async () => { asked++; return false; };
  const me = await (await call(c, 'POST', '/api/profile')).json();
  await c.db.prepare('INSERT INTO limits (bucket, count, until) VALUES (?, ?, ?)').bind(`l:${await addressKey('1.1.1.1', c.now)}`, LOOKUPS - 2, c.now + 1000).run();
  const films = Array.from({ length: 5 }, (_, i) => ({ film: `f-${i}` }));
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'N', films } })).json();
  assert.equal(asked, 2);
  assert.deepEqual((await (await call(c, 'GET', `/api/channel/${id}`)).json()).films.map(f => f.flagged), [false, false, true, true, true]);
  await c.db.prepare("UPDATE profiles SET agreed_at = 1 WHERE id = ?").bind(me.id).run();
  assert.equal((await (await call(c, 'POST', `/api/channel/${id}/submit`, { auth: me })).json()).problem, 'flagged');
  assert.equal(asked, 2, 'no lookup past the cap, on submit either');
  const other = await (await call(c, 'POST', '/api/profile', { ip: '2.2.2.2' })).json();
  await call(c, 'POST', '/api/channel', { auth: other, ip: '2.2.2.2', body: { name: 'M', films } });
  assert.equal(asked, 7, 'another address has its own budget');
});

test('submit does not look anything up for a hidden channel', async () => {
  const c = await ctx();
  let asked = 0;
  c.flag = async () => { asked++; return true; };
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'N', films: [{ film: 'a' }] } })).json();
  await c.db.prepare("UPDATE profiles SET agreed_at = 1 WHERE id = ?").bind(me.id).run();
  await c.db.prepare("UPDATE channels SET status = 'hidden' WHERE id = ?").bind(id).run();
  asked = 0;
  assert.equal((await (await call(c, 'POST', `/api/channel/${id}/submit`, { auth: me })).json()).problem, 'hidden');
  assert.equal(asked, 0);
});

test('passkey: register as owner, then sign in anywhere returns a new key', async () => {
  const c = { ...(await ctx()), webauthn: fakeWebauthn() };
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const opts = await (await call(c, 'POST', '/api/passkey/options', { auth: me })).json();
  assert.equal((await call(c, 'POST', '/api/passkey', { auth: me, body: resp('credA-padding-xxxx', opts.challenge) })).status, 204);
  const list = await call(c, 'GET', '/api/passkey', { auth: me });
  assert.equal(list.headers.get('cache-control'), 'no-store');
  assert.equal((await list.json()).passkeys.length, 1);
  const so = await (await call(c, 'POST', '/api/passkey/challenge')).json();
  const out = await (await call(c, 'POST', '/api/passkey/verify', { body: resp('credA-padding-xxxx', so.challenge, { counter: 1 }) })).json();
  assert.equal(out.id, me.id);
  assert.notEqual(out.key, me.key);
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { name: 'x' } })).status, 401);
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: out, body: { name: 'x' } })).status, 204);
});

test('passkey: anonymous cannot register or list; other origins refused', async () => {
  const c = { ...(await ctx()), webauthn: fakeWebauthn() };
  assert.equal((await call(c, 'POST', '/api/passkey/options')).status, 401);
  assert.equal((await call(c, 'GET', '/api/passkey')).status, 401);
  const res = await handle(new Request('https://www.orphanedfilms.com/api/passkey/challenge', { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' } }), c);
  assert.equal(res.status, 403);
});

test('passkey: anonymous register is refused; a cross-site options call is refused even with a valid key', async () => {
  const c = { ...(await ctx()), webauthn: fakeWebauthn() };
  assert.equal((await call(c, 'POST', '/api/passkey', { body: resp('credA-padding-xxxx', 'reg1') })).status, 401);
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const authorization = `Bearer ${me.id}.${me.key}`;
  const evil = await handle(new Request(`${ORIGIN}/api/passkey/options`, { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', authorization } }), c);
  assert.equal(evil.status, 403);
  const noOrigin = await handle(new Request(`${ORIGIN}/api/passkey/options`, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site', authorization } }), c);
  assert.equal(noOrigin.status, 403);
  assert.equal((await call(c, 'POST', '/api/passkey/options', { auth: me })).status, 200);
});

test('passkey: limits apply to challenges', async () => {
  const c = { ...(await ctx()), webauthn: fakeWebauthn() };
  for (let i = 0; i < 30; i++) assert.equal((await call(c, 'POST', '/api/passkey/challenge', { ip: '8.8.8.8' })).status, 200);
  assert.equal((await call(c, 'POST', '/api/passkey/challenge', { ip: '8.8.8.8' })).status, 429);
});

test('passkey: a failed sign-in, a removal, and a full profile', async () => {
  const c = { ...(await ctx()), webauthn: fakeWebauthn() };
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const so = await (await call(c, 'POST', '/api/passkey/challenge')).json();
  const bad = await call(c, 'POST', '/api/passkey/verify', { body: resp('unknown-padding-xxxx', so.challenge) });
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await bad.json(), { error: 'invalid' });
  for (let i = 0; i < 5; i++) {
    const o = await (await call(c, 'POST', '/api/passkey/options', { auth: me })).json();
    assert.equal((await call(c, 'POST', '/api/passkey', { auth: me, body: resp(`k${i}-padding-xxxxxxxx`, o.challenge) })).status, 204);
  }
  const full = await call(c, 'POST', '/api/passkey/options', { auth: me });
  assert.equal(full.status, 409);
  assert.deepEqual(await full.json(), { error: 'full' });
  assert.equal((await call(c, 'DELETE', '/api/passkey/k0-padding-xxxxxxxx', { auth: me })).status, 204);
  assert.equal((await call(c, 'DELETE', '/api/passkey/k0-padding-xxxxxxxx', { auth: me })).status, 404);
  const other = await (await call(c, 'POST', '/api/profile', { ip: '2.2.2.2' })).json();
  assert.equal((await call(c, 'DELETE', '/api/passkey/k1-padding-xxxxxxxx', { auth: other })).status, 404);
});

test('profile: reserved names are refused', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const bad = await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { name: 'Admin' } });
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: 'reserved' });
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { name: 'Night Owl' } })).status, 204);
});

test('profile: a handle is set by its owner, refused with a reason, read by handle', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const other = await (await call(c, 'POST', '/api/profile', { ip: '2.2.2.2' })).json();
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { handle: 'Night-Owl' } })).status, 204);
  for (const [handle, error] of [['night-owl', 'taken'], ['admin', 'reserved'], ['a', 'invalid'], [other.id, 'taken']]) {
    const res = await call(c, 'PATCH', `/api/profile/${other.id}`, { auth: other, body: { handle } });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error }, handle);
  }
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: other, body: { handle: 'mine' } })).status, 404);
  const read = await call(c, 'GET', '/api/profile/night-owl');
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal((await read.json()).id, me.id);
  assert.equal((await (await call(c, 'GET', `/api/profile/${me.id}`)).json()).handle, 'night-owl');
  assert.equal((await (await call(c, 'GET', `/api/profile/${other.id}`)).json()).handle, null);

  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { handle: 'owl' } })).status, 204);
  assert.deepEqual(await (await call(c, 'GET', '/api/profile/night-owl')).json(), { moved: 'owl' });
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { handle: null } })).status, 204);
  assert.deepEqual(await (await call(c, 'GET', '/api/profile/owl')).json(), { moved: me.id });
  assert.equal((await call(c, 'GET', '/api/profile/nobody-here')).status, 404);
});

test('handle availability: anyone may ask, the owner sees its own held handle as free, never cached', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { handle: 'reel' } });
  await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { handle: 'reels' } });
  const ask = (h, headers = {}) => handle(new Request(`${ORIGIN}/api/handle/${h}`, { headers: { 'cf-connecting-ip': '3.3.3.3', ...headers } }), c);
  let res = await ask('Reel');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { available: false, reason: 'taken', suggestions: ['reel2', 'reel_films', 'reel-tv'] });
  assert.deepEqual(await (await ask('reel', { authorization: `Bearer ${me.id}.${me.key}` })).json(), { available: true });
  assert.deepEqual(await (await ask('reels', { authorization: `Bearer ${me.id}.${me.key}` })).json(), { available: true });
  assert.deepEqual(await (await ask('reel', { authorization: `Bearer ${me.id}.bad` })).json(), { available: false, reason: 'taken', suggestions: ['reel2', 'reel_films', 'reel-tv'] });
  assert.deepEqual(await (await ask('fresh-name')).json(), { available: true });
  assert.deepEqual(await (await ask('staff')).json(), { available: false, reason: 'reserved' });
  assert.deepEqual(await (await ask('no--no')).json(), { available: false, reason: 'invalid' });
  assert.equal((await ask('%E0%A4%A')).status, 400);
});

test('handle availability is limited per address', async () => {
  const c = await ctx();
  const ask = ip => handle(new Request(`${ORIGIN}/api/handle/night`, { headers: { 'cf-connecting-ip': ip } }), c);
  for (let i = 0; i < 60; i++) assert.equal((await ask('4.4.4.4')).status, 200);
  assert.equal((await ask('4.4.4.4')).status, 429);
  assert.equal((await ask('5.5.5.5')).status, 200);
});
