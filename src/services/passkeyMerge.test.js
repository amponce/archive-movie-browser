import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { createProfile, createChannel, setFavourite, setSaved, LIMITS } from '../../api/_community.js';
import { fakeWebauthn as fake, rp, resp } from './fakeWebauthn.js';
import { registrationOptions, register, signinOptions, signin, FRESH_MS } from '../../api/_passkeys.js';
import { handle } from '../../api/community.js';

const now = 1_800_000_000_000;
const flag = async () => false;

// Profile A with a passkey, and a sign-in to it with `from`
async function setup() {
  const db = await openTestDb(); const w = fake();
  const a = await createProfile(db, { now: now - 30 * 86_400_000 });
  const o = await registrationOptions(db, w, a.id, { rp, now });
  await register(db, w, a.id, resp('merge-padding-xxxxxx', o.challenge), { rp, now });
  const signInWith = async (from, at = now) => {
    const so = await signinOptions(db, w, { rp, now: at });
    return signin(db, w, resp('merge-padding-xxxxxx', so.challenge), { rp, now: at, from });
  };
  const ids = async (sql, id) => (await db.prepare(sql).bind(id).all()).results.map(r => Object.values(r)[0]).sort();
  return { db, w, a, signInWith, ids };
}

test('a fresh profile is folded in: favourites, channels and saves move, the profile goes', async () => {
  const { db, a, signInWith, ids } = await setup();
  const other = await createProfile(db, { now });
  const theirs = await createChannel(db, other.id, { name: 'Theirs', films: [] }, { now, flag });
  const mine = await createChannel(db, a.id, { name: 'Mine', films: [] }, { now, flag });
  await setFavourite(db, a.id, 'Detour', true, { now });
  const b = await createProfile(db, { now: now - 3600_000 });
  await setFavourite(db, b.id, 'Detour', true, { now });
  await setFavourite(db, b.id, 'Nosferatu', true, { now });
  const bc = await createChannel(db, b.id, { name: 'My channel', films: [{ film: 'Nosferatu' }] }, { now, flag });
  await db.prepare("UPDATE channels SET status = 'submitted' WHERE id = ?").bind(bc).run();
  await setSaved(db, b.id, theirs, true, { now });
  await setSaved(db, b.id, mine, true, { now });
  await setSaved(db, other.id, bc, true, { now });

  const out = await signInWith({ id: b.id, key: b.key });
  assert.equal(out.id, a.id);
  assert.equal(out.merged, 'all');
  assert.deepEqual(out.moved, { merged: 'all', from: b.id, favourites: 1, channels: 1 });
  assert.deepEqual(await ids('SELECT film_id FROM favourites WHERE profile_id = ?', a.id), ['Detour', 'Nosferatu']);
  const moved = await db.prepare('SELECT profile_id, status FROM channels WHERE id = ?').bind(bc).first();
  assert.deepEqual(moved, { profile_id: a.id, status: 'submitted' }, 'same id and status');
  assert.deepEqual(await ids('SELECT film_id FROM channel_films WHERE channel_id = ?', bc), ['Nosferatu']);
  assert.deepEqual(await ids('SELECT channel_id FROM channel_saves WHERE profile_id = ?', a.id), [theirs], 'a save of its own channel is skipped');
  assert.deepEqual(await ids('SELECT profile_id FROM channel_saves WHERE channel_id = ?', bc), [other.id], 'saves by others stay');
  assert.equal(await db.prepare('SELECT 1 FROM profiles WHERE id = ?').bind(b.id).first(), null);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM favourites WHERE profile_id = ?').bind(b.id).first()).n, 0);
});

test('a profile that is not fresh is left alone', async () => {
  const { db, signInWith } = await setup();
  const old = await createProfile(db, { now: now - FRESH_MS - 1 });
  await setFavourite(db, old.id, 'Detour', true, { now });
  assert.equal((await signInWith({ id: old.id, key: old.key })).merged, 'none');
  const named = await createProfile(db, { now });
  await db.prepare("UPDATE profiles SET handle = 'night-owl' WHERE id = ?").bind(named.id).run();
  assert.equal((await signInWith({ id: named.id, key: named.key })).merged, 'none');
  const hidden = await createProfile(db, { now });
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(hidden.id).run();
  assert.equal((await signInWith({ id: hidden.id, key: hidden.key })).merged, 'none');
  for (const p of [old, named, hidden]) assert.ok(await db.prepare('SELECT 1 FROM profiles WHERE id = ?').bind(p.id).first());
});

test('a profile with a passkey is left alone', async () => {
  const { db, w, signInWith } = await setup();
  const b = await createProfile(db, { now });
  const o = await registrationOptions(db, w, b.id, { rp, now });
  assert.equal(await register(db, w, b.id, resp('other-padding-xxxxxx', o.challenge), { rp, now }), 'ok');
  assert.equal((await signInWith({ id: b.id, key: b.key })).merged, 'none');
  assert.ok(await db.prepare('SELECT 1 FROM profiles WHERE id = ?').bind(b.id).first());
});

test('the signed-in profile itself, a wrong key or no from: nothing merged', async () => {
  const { db, a, signInWith } = await setup();
  const b = await createProfile(db, { now });
  await setFavourite(db, b.id, 'Detour', true, { now });
  assert.equal((await signInWith({ id: a.id, key: a.key })).merged, 'none');
  const out = await signInWith({ id: b.id, key: 'f'.repeat(64) });
  assert.equal(out.merged, 'none');
  assert.equal(out.id, a.id, 'the sign-in still works');
  assert.equal((await signInWith({ id: 'not an id' })).merged, 'none');
  assert.equal((await signInWith(undefined)).merged, 'none');
  assert.ok(await db.prepare('SELECT 1 FROM profiles WHERE id = ?').bind(b.id).first());
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM favourites WHERE profile_id = ?').bind(a.id).first()).n, 0);
});

test('past the channel limit only favourites are copied and the profile stays', async () => {
  const { db, a, signInWith } = await setup();
  for (let i = 0; i < LIMITS.channels; i++) await createChannel(db, a.id, { name: `c${i}`, films: [] }, { now, flag });
  const b = await createProfile(db, { now });
  await setFavourite(db, b.id, 'Detour', true, { now });
  const bc = await createChannel(db, b.id, { name: 'One more', films: [] }, { now, flag });
  const out = await signInWith({ id: b.id, key: b.key });
  assert.equal(out.merged, 'partial');
  assert.deepEqual(out.moved, { merged: 'partial', from: b.id, favourites: 1, channels: 0 });
  assert.ok(await db.prepare('SELECT 1 FROM favourites WHERE profile_id = ? AND film_id = ?').bind(a.id, 'Detour').first());
  assert.equal((await db.prepare('SELECT profile_id FROM channels WHERE id = ?').bind(bc).first()).profile_id, b.id);
  assert.ok(await db.prepare('SELECT 1 FROM profiles WHERE id = ?').bind(b.id).first());
  assert.ok(await db.prepare('SELECT 1 FROM favourites WHERE profile_id = ?').bind(b.id).first(), 'its own favourites stay');
});

test('the route takes from, answers merged and writes a history row', async () => {
  const db = await openTestDb();
  const c = { db, webauthn: fake(), flag, minutes: async () => ({}), now, netSalt: 'a-salt-of-sixteen-chars' };
  const ORIGIN = 'https://www.orphanedfilms.com';
  const call = (method, path, { body, auth } = {}) => handle(new Request(ORIGIN + path, {
    method, body: body && JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '1.1.1.1', ...(auth && { authorization: `Bearer ${auth.id}.${auth.key}` }) },
  }), c);
  const a = await (await call('POST', '/api/profile')).json();
  const o = await (await call('POST', '/api/passkey/options', { auth: a })).json();
  assert.equal((await call('POST', '/api/passkey', { auth: a, body: resp('route-padding-xxxxxx', o.challenge) })).status, 204);
  const b = await (await call('POST', '/api/profile')).json();
  assert.equal((await call('PUT', `/api/profile/${b.id}/favourites/Detour`, { auth: b })).status, 204);
  const so = await (await call('POST', '/api/passkey/challenge')).json();
  const res = await call('POST', '/api/passkey/verify', { body: { ...resp('route-padding-xxxxxx', so.challenge), from: { id: b.id, key: b.key } } });
  const out = await res.json();
  assert.deepEqual(Object.keys(out).sort(), ['id', 'key', 'merged']);
  assert.equal(out.id, a.id);
  assert.equal(out.merged, 'all');
  const row = await db.prepare("SELECT profile_id, detail, net FROM history WHERE kind = 'profile-merged'").first();
  assert.equal(row.profile_id, a.id);
  assert.deepEqual(JSON.parse(row.detail), { from: b.id, favourites: 1, channels: 0 });
  assert.match(row.net, /^[0-9a-f]{16}$/);
  assert.equal((await call('GET', `/api/profile/${b.id}`)).status, 404);
  // A sign-in with nothing to fold in writes no row
  const again = await (await call('POST', '/api/passkey/challenge')).json();
  assert.equal((await (await call('POST', '/api/passkey/verify', { body: resp('route-padding-xxxxxx', again.challenge) })).json()).merged, 'none');
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM history WHERE kind = 'profile-merged'").first()).n, 1);
});
