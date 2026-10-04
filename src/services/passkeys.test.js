import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { createProfile, authProfile } from '../../api/_community.js';
import { fakeWebauthn as fake, rp, resp } from './fakeWebauthn.js';
import { rpFor, registrationOptions, register, listPasskeys, removePasskey, signinOptions, signin, MAX_PASSKEYS } from '../../api/_passkeys.js';

const now = 1_800_000_000_000;

test('only our origins get a relying party', () => {
  assert.deepEqual(rpFor('https://www.orphanedfilms.com'), rp);
  assert.deepEqual(rpFor('https://orphanedfilms.com'), { rpID: 'orphanedfilms.com', origin: 'https://orphanedfilms.com' });
  assert.deepEqual(rpFor('http://localhost:8787', 'http://localhost:8787/api/x'), { rpID: 'localhost', origin: 'http://localhost:8787' });
  assert.deepEqual(rpFor('http://localhost:8787', 'http://127.0.0.1:8787/api/x'), { rpID: 'localhost', origin: 'http://localhost:8787' });
  assert.equal(rpFor('http://localhost:8787', 'https://www.orphanedfilms.com/api/x'), null);
  assert.equal(rpFor('http://localhost:8787'), null);
  assert.equal(rpFor('https://evil.example'), null);
  assert.equal(rpFor('https://orphanedfilms.com.evil.example'), null);
});

test('register, list, then sign in rotates the edit key', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const opts = await registrationOptions(db, w, p.id, { rp, now });
  assert.equal(opts.o.userName, 'Orphaned Films profile');
  assert.notEqual(opts.o.userID, p.id);
  assert.equal(await register(db, w, p.id, resp('cred1-padding-xxxx', opts.challenge), { rp, now }), 'ok');
  assert.equal((await listPasskeys(db, p.id)).length, 1);
  const so = await signinOptions(db, w, { rp, now });
  const out = await signin(db, w, resp('cred1-padding-xxxx', so.challenge, { counter: 1 }), { rp, now });
  assert.equal(out.id, p.id);
  assert.match(out.key, /^[0-9a-f]{64}$/);
  assert.notEqual(out.key, p.key);
  assert.equal(await authProfile(db, p.id, p.key), null, 'old key stops working');
  assert.ok(await authProfile(db, p.id, out.key));
});

test('a challenge is single use and expires', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const opts = await registrationOptions(db, w, p.id, { rp, now });
  assert.equal(await register(db, w, p.id, resp('c-padding-xxxxxxxxx', opts.challenge), { rp, now }), 'ok');
  assert.equal(await register(db, w, p.id, resp('c2-padding-xxxxxxx', opts.challenge), { rp, now }), 'expired');
  const late = await registrationOptions(db, w, p.id, { rp, now });
  assert.equal(await register(db, w, p.id, resp('c3-padding-xxxxxxx', late.challenge), { rp, now: now + 300_001 }), 'expired');
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, resp('c-padding-xxxxxxxxx', so.challenge), { rp, now: now + 300_001 }), 'expired');
});

test('a registration challenge belongs to its profile', async () => {
  const db = await openTestDb(); const w = fake();
  const a = await createProfile(db, { now }); const b = await createProfile(db, { now });
  const opts = await registrationOptions(db, w, a.id, { rp, now });
  assert.equal(await register(db, w, b.id, resp('x-padding-xxxxxxxxx', opts.challenge), { rp, now }), 'expired');
});

test('five passkeys at most; removing works; an unknown credential reads as unknown', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  for (let i = 0; i < MAX_PASSKEYS; i++) {
    const o = await registrationOptions(db, w, p.id, { rp, now });
    assert.equal(await register(db, w, p.id, resp(`k${i}-padding-xxxxxxxx`, o.challenge), { rp, now }), 'ok');
  }
  assert.equal(await registrationOptions(db, w, p.id, { rp, now }), 'full');
  assert.equal(await removePasskey(db, p.id, 'k0-padding-xxxxxxxx'), true);
  assert.equal(await removePasskey(db, p.id, 'nope-padding-xxxxxx'), false);
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, resp('nope-padding-xxxxxx', so.challenge), { rp, now }), 'unknown');
});

test('a hidden profile cannot register or sign in', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const o = await registrationOptions(db, w, p.id, { rp, now });
  await register(db, w, p.id, resp('h-padding-xxxxxxxxx', o.challenge), { rp, now });
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(p.id).run();
  assert.equal(await registrationOptions(db, w, p.id, { rp, now }), 'hidden');
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, resp('h-padding-xxxxxxxxx', so.challenge), { rp, now }), 'hidden');
});

test('a counter that goes backwards is refused', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const o = await registrationOptions(db, w, p.id, { rp, now });
  await register(db, w, p.id, resp('cc-padding-xxxxxxxx', o.challenge), { rp, now });
  let so = await signinOptions(db, w, { rp, now });
  assert.ok((await signin(db, w, resp('cc-padding-xxxxxxxx', so.challenge, { counter: 5 }), { rp, now })).key);
  w.verifyAuthenticationResponse = async () => { throw new Error('counter'); };
  so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, resp('cc-padding-xxxxxxxx', so.challenge, { counter: 3 }), { rp, now }), 'invalid');
});

test('a challenge cannot be used twice at once', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const o = await registrationOptions(db, w, p.id, { rp, now });
  await register(db, w, p.id, resp('cr-padding-xxxxxxxxx', o.challenge), { rp, now });
  const so = await signinOptions(db, w, { rp, now });
  const outs = await Promise.all([1, 2].map(() => signin(db, w, resp('cr-padding-xxxxxxxxx', so.challenge), { rp, now })));
  assert.equal(outs.filter(o => o?.key).length, 1);
  assert.equal(outs.filter(o => o === 'expired').length, 1);
});

test('another profile cannot take over a credential id', async () => {
  const db = await openTestDb(); const w = fake();
  const a = await createProfile(db, { now }); const b = await createProfile(db, { now });
  const oa = await registrationOptions(db, w, a.id, { rp, now });
  assert.equal(await register(db, w, a.id, resp('cred1-padding-xxxx', oa.challenge), { rp, now }), 'ok');
  const ob = await registrationOptions(db, w, b.id, { rp, now });
  assert.equal(await register(db, w, b.id, resp('cred1-padding-xxxx', ob.challenge), { rp, now }), 'invalid');
  const so = await signinOptions(db, w, { rp, now });
  assert.equal((await signin(db, w, resp('cred1-padding-xxxx', so.challenge), { rp, now })).id, a.id);
});

test('the cap holds when registrations overlap', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const opts = [];
  for (let i = 0; i < MAX_PASSKEYS + 2; i++) opts.push(await registrationOptions(db, w, p.id, { rp, now }));
  const outs = await Promise.all(opts.map((o, i) => register(db, w, p.id, resp(`ov${i}-padding-xxxxxxxx`, o.challenge), { rp, now })));
  assert.equal(outs.filter(r => r === 'ok').length, MAX_PASSKEYS);
  assert.equal((await listPasskeys(db, p.id)).length, MAX_PASSKEYS);
});

test('a challenge belongs to its kind', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await register(db, w, p.id, resp('kb-padding-xxxxxxxxx', so.challenge), { rp, now }), 'expired');
  const o = await registrationOptions(db, w, p.id, { rp, now });
  assert.equal(await signin(db, w, resp('kb-padding-xxxxxxxxx', o.challenge), { rp, now }), 'expired');
});

test('an unknown credential or profile is refused', async () => {
  const db = await openTestDb(); const w = fake();
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, resp('unknown-padding-xxxxx', so.challenge), { rp, now }), 'unknown');
  assert.equal(await register(db, w, 'zzzzzzzzzz', resp('u2-padding-xxxxxxxxx', 'nope'), { rp, now }), 'expired');
});

test('a challenge name outside the signed data is not accepted', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const o = await registrationOptions(db, w, p.id, { rp, now });
  assert.equal(await register(db, w, p.id, { id: 'tl-padding-xxxxxxxxx', challenge: o.challenge }, { rp, now }), 'expired');
});

test('a sign-in the key change did not reach hands back no key', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const o = await registrationOptions(db, w, p.id, { rp, now });
  await register(db, w, p.id, resp('rot-padding-xxxxxxxxx', o.challenge), { rp, now });
  const so = await signinOptions(db, w, { rp, now });
  // the profile is hidden after the credential lookup, just before the key change
  const racing = { ...db, batch: async (s) => { await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(p.id).run(); return db.batch(s); } };
  assert.equal(await signin(racing, w, resp('rot-padding-xxxxxxxxx', so.challenge), { rp, now }), 'hidden');
});
