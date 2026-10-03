import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { handle } from '../../api/community.js';
import { netTag, detailText, DETAIL_MAX } from '../../api/_history.js';

const ORIGIN = 'https://www.orphanedfilms.com';
const SALT = 'a-test-salt-of-some-length';
const ctx = async (extra = {}) => ({ db: await openTestDb(), flag: async () => false, minutes: async () => ({}), now: 1_700_000_000_000, netSalt: SALT, ...extra });
const call = (c, method, path, { body, auth, ip = '1.1.1.1' } = {}) => handle(new Request(ORIGIN + path, {
  method, body: body && JSON.stringify(body),
  headers: { 'content-type': 'application/json', origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': ip, ...(auth && { authorization: `Bearer ${auth.id}.${auth.key}` }) },
}), c);
const rows = async c => (await c.db.prepare('SELECT * FROM history ORDER BY id').all()).results.map(r => ({ ...r, detail: r.detail && JSON.parse(r.detail) }));
const films = n => Array.from({ length: n }, (_, i) => ({ film: `film-${i}` }));

test('net is an HMAC of the address: same address same tag, none without a salt', async () => {
  const a = await netTag('1.1.1.1', SALT);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(await netTag('1.1.1.1', SALT), a);
  assert.notEqual(await netTag('2.2.2.2', SALT), a);
  assert.notEqual(await netTag('1.1.1.1', `${SALT}x`), a);
  assert.equal(await netTag('1.1.1.1', undefined), null);
  assert.equal(await netTag('1.1.1.1', 'short'), null);
  assert.equal(await netTag(null, SALT), null);
});

test('an IPv6 address is tagged by its /64 network', async () => {
  const a = await netTag('2001:db8:1:2::1', SALT);
  assert.equal(await netTag('2001:0DB8:0001:0002:aaaa:bbbb:cccc:dddd', SALT), a);
  assert.equal(await netTag('2001:db8:1:2:ffff::', SALT), a);
  assert.notEqual(await netTag('2001:db8:1:3::1', SALT), a);
  assert.equal(await netTag('::ffff:1.1.1.1', SALT), await netTag('1.1.1.1', SALT));
});

test('each change leaves one row; favourites and saves leave none', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { name: 'Ann', agreed: true } })).status, 204);
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { name: 'Ann' } })).status, 204);
  assert.equal((await call(c, 'PUT', `/api/profile/${me.id}/favourites/Detour`, { auth: me })).status, 204);
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'Night', description: 'd', films: films(5) } })).json();
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: me, body: { name: 'Late' } })).status, 204);
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: me, body: { name: 'Late' } })).status, 204);
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: me, body: { films: films(6) } })).status, 204);
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: me, body: { films: films(6).map((f, i) => ({ ...f, note: i === 2 ? 'a note' : '' })) } })).status, 204);
  assert.equal((await call(c, 'POST', `/api/channel/${id}/submit`, { auth: me })).status, 204);
  assert.equal((await call(c, 'POST', `/api/channel/${id}/submit`, { auth: me })).status, 204);
  assert.equal((await call(c, 'PUT', `/api/channel/${id}/save`, { auth: me })).status, 204);
  assert.equal((await call(c, 'DELETE', `/api/channel/${id}`, { auth: me })).status, 204);

  const log = await rows(c);
  const net = await netTag('1.1.1.1', SALT);
  assert.deepEqual(log.map(r => r.kind), ['profile-created', 'profile-edited', 'channel-created', 'channel-edited', 'channel-edited', 'channel-edited', 'channel-submitted', 'channel-deleted']);
  assert.ok(log.every(r => r.net === net && r.profile_id === me.id && r.at === c.now));
  assert.deepEqual(log[1].detail, { name: 'Ann' });
  const ids = n => films(n).map(f => f.film);
  const notes = ['', '', 'a note', '', '', ''];
  assert.deepEqual(log[2].detail, { name: 'Night', description: 'd', films: ids(5), notes: ['', '', '', '', ''] });
  assert.equal(log[2].channel_id, id);
  assert.deepEqual(log[3].detail, { name: 'Late' });
  assert.deepEqual(log[4].detail, { films: ids(6), notes: ['', '', '', '', '', ''] });
  assert.deepEqual(log[5].detail, { films: ids(6), notes }, 'a change to notes alone keeps the note text');
  assert.equal(log[6].detail, null);
  assert.deepEqual(log[7].detail, { name: 'Late', description: 'd', films: ids(6), notes });
  assert.ok(!JSON.stringify(log).includes('1.1.1.1'), 'the address itself is not stored');
});

test('a handle change is recorded; refused and failed writes leave no row', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const other = await (await call(c, 'POST', '/api/profile', { ip: '2.2.2.2' })).json();
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { handle: 'night-owl' } })).status, 204);
  assert.equal((await call(c, 'PATCH', `/api/profile/${other.id}`, { auth: other, body: { handle: 'night-owl' } })).status, 400);
  assert.equal((await call(c, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { name: 'Official team' } })).status, 400);
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'N', films: [] } })).json();
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: other, body: { name: 'x' } })).status, 404);
  assert.equal((await call(c, 'DELETE', `/api/channel/${id}`, { auth: other })).status, 404);
  assert.equal((await call(c, 'POST', `/api/channel/${id}/submit`, { auth: me })).status, 409);
  assert.equal((await call(c, 'PATCH', `/api/channel/${id}`, { auth: { id: me.id, key: 'bad' }, body: { name: 'x' } })).status, 401);
  const log = await rows(c);
  assert.deepEqual(log.map(r => r.kind), ['profile-created', 'profile-created', 'profile-edited', 'channel-created']);
  assert.deepEqual(log[2].detail, { handle: 'night-owl' });
});

test('without a salt the tag is empty; a history failure does not fail the change', async () => {
  const c = await ctx({ netSalt: undefined });
  await call(c, 'POST', '/api/profile');
  assert.equal((await rows(c))[0].net, null);
  const broken = { ...c.db, prepare: sql => (sql.startsWith('INSERT INTO history') ? { bind: () => ({ run: async () => { throw new Error('no table'); } }) } : c.db.prepare(sql)) };
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal((await call({ ...c, db: broken }, 'POST', '/api/profile', { ip: '3.3.3.3' })).status, 201);
  } finally { console.error = error; }
});

test('a failed read while building a row still answers the change normally', async () => {
  const c = await ctx();
  const me = await (await call(c, 'POST', '/api/profile')).json();
  const { id } = await (await call(c, 'POST', '/api/channel', { auth: me, body: { name: 'N', films: [] } })).json();
  const broken = { ...c.db, prepare: sql => (/^SELECT (name, description FROM channels|name, archive_user, handle|status FROM channels)/.test(sql) ? { bind: () => ({ first: async () => { throw new Error('read failed'); } }) } : c.db.prepare(sql)) };
  const b = { ...c, db: broken };
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal((await call(b, 'POST', '/api/channel', { auth: me, body: { name: 'M', films: [] } })).status, 201);
    assert.equal((await call(b, 'PATCH', `/api/channel/${id}`, { auth: me, body: { name: 'Renamed' } })).status, 204);
    assert.equal((await call(b, 'PATCH', `/api/profile/${me.id}`, { auth: me, body: { name: 'Ann' } })).status, 204);
    assert.equal((await call(b, 'DELETE', `/api/channel/${id}`, { auth: me })).status, 204);
  } finally { console.error = error; }
  const channels = (await c.db.prepare('SELECT name FROM channels').all()).results.map(r => r.name);
  assert.deepEqual(channels, ['M'], 'one channel made, the other deleted');
  const log = await rows(c);
  assert.equal(log.filter(r => r.kind === 'channel-created').length, 1, 'the row whose read failed is skipped');
  assert.deepEqual(log.find(r => r.kind === 'channel-edited').detail, null, 'an edit without its earlier state is kept without detail');
});

test('a full channel with long notes fits the cap; films and notes are cut together', async () => {
  const film = i => `${'x'.repeat(196)}-${i}`.slice(0, 200);
  const full = { name: 'N'.repeat(80), description: 'd'.repeat(500), films: Array.from({ length: 40 }, (_, i) => film(i)), notes: Array.from({ length: 40 }, () => 'é'.repeat(280)) };
  const detail = JSON.parse(detailText(full));
  assert.ok(new TextEncoder().encode(detailText(full)).length <= DETAIL_MAX);
  assert.ok(detail.films.length > 0);
  assert.equal(detail.notes.length, detail.films.length);
  assert.equal(detail.films.length + detail.more, 40);
});

test('detail is capped at 8 KB by cutting the film list', async () => {
  const long = Array.from({ length: 40 }, (_, i) => `${'x'.repeat(196)}-${i}`.slice(0, 200));
  const text = detailText({ name: 'N', description: 'd'.repeat(500), films: long });
  assert.ok(new TextEncoder().encode(text).length <= DETAIL_MAX);
  const detail = JSON.parse(text);
  assert.equal(detail.films.length + detail.more, 40);
  assert.deepEqual(detail.films, long.slice(0, detail.films.length));
  assert.equal(detailText({ name: 'short' }), '{"name":"short"}');
  assert.equal(detailText(null), null);
});

test('the Worker hands NET_SALT to the community handler', async () => {
  const { default: worker } = await import('../../worker.js');
  const env = { DB: await openTestDb(), NET_SALT: SALT };
  const res = await worker.fetch(new Request(`${ORIGIN}/api/profile`, { method: 'POST', headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '4.4.4.4' } }), env, { waitUntil() {} });
  assert.equal(res.status, 201);
  assert.equal((await rows({ db: env.DB }))[0].net, await netTag('4.4.4.4', SALT));
});
