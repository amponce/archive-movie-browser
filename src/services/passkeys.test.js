import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { createProfile, authProfile } from '../../api/_community.js';
import { rpFor, registrationOptions, register, listPasskeys, removePasskey, signinOptions, signin, MAX_PASSKEYS } from '../../api/_passkeys.js';

const now = 1_800_000_000_000;
const rp = { rpID: 'orphanedfilms.com', origin: 'https://www.orphanedfilms.com' };
// A fake WebAuthn library: options echo a fixed challenge; verification succeeds when the
// response carries the expected challenge and credential, fails otherwise
const fake = () => {
  let n = 0;
  return {
    generateRegistrationOptions: async (o) => ({ challenge: `reg${++n}`, user: { id: o.userID }, rp: { id: o.rpID }, o }),
    verifyRegistrationResponse: async ({ response, expectedChallenge, expectedOrigin, expectedRPID }) => (
      response.challenge === expectedChallenge && expectedOrigin === rp.origin && expectedRPID === rp.rpID
        ? { verified: true, registrationInfo: { credential: { id: response.id, publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } } }
        : { verified: false }),
    generateAuthenticationOptions: async () => ({ challenge: `auth${++n}` }),
    verifyAuthenticationResponse: async ({ response, expectedChallenge, credential }) => (
      response.challenge === expectedChallenge && response.id === credential.id
        ? { verified: true, authenticationInfo: { newCounter: (response.counter ?? credential.counter + 1) } }
        : { verified: false }),
  };
};

test('only our origins get a relying party', () => {
  assert.deepEqual(rpFor('https://www.orphanedfilms.com'), rp);
  assert.deepEqual(rpFor('https://orphanedfilms.com'), { rpID: 'orphanedfilms.com', origin: 'https://orphanedfilms.com' });
  assert.deepEqual(rpFor('http://localhost:8787'), { rpID: 'localhost', origin: 'http://localhost:8787' });
  assert.equal(rpFor('https://evil.example'), null);
  assert.equal(rpFor('https://orphanedfilms.com.evil.example'), null);
});

test('register, list, then sign in rotates the edit key', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const opts = await registrationOptions(db, w, p.id, { rp, now });
  assert.equal(opts.o.userName, 'Orphaned Films profile');
  assert.notEqual(opts.o.userID, p.id);
  assert.equal(await register(db, w, p.id, { id: 'cred1', challenge: opts.challenge }, { rp, now }), 'ok');
  assert.equal((await listPasskeys(db, p.id)).length, 1);
  const so = await signinOptions(db, w, { rp, now });
  const out = await signin(db, w, { id: 'cred1', challenge: so.challenge, counter: 1 }, { rp, now });
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
  assert.equal(await register(db, w, p.id, { id: 'c', challenge: opts.challenge }, { rp, now }), 'ok');
  assert.equal(await register(db, w, p.id, { id: 'c2', challenge: opts.challenge }, { rp, now }), 'expired');
  const late = await registrationOptions(db, w, p.id, { rp, now });
  assert.equal(await register(db, w, p.id, { id: 'c3', challenge: late.challenge }, { rp, now: now + 300_001 }), 'expired');
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, { id: 'c', challenge: so.challenge }, { rp, now: now + 300_001 }), 'expired');
});

test('a registration challenge belongs to its profile', async () => {
  const db = await openTestDb(); const w = fake();
  const a = await createProfile(db, { now }); const b = await createProfile(db, { now });
  const opts = await registrationOptions(db, w, a.id, { rp, now });
  assert.equal(await register(db, w, b.id, { id: 'x', challenge: opts.challenge }, { rp, now }), 'expired');
});

test('five passkeys at most; removing works; unknown credential is invalid', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  for (let i = 0; i < MAX_PASSKEYS; i++) {
    const o = await registrationOptions(db, w, p.id, { rp, now });
    assert.equal(await register(db, w, p.id, { id: `k${i}`, challenge: o.challenge }, { rp, now }), 'ok');
  }
  assert.equal(await registrationOptions(db, w, p.id, { rp, now }), 'full');
  assert.equal(await removePasskey(db, p.id, 'k0'), true);
  assert.equal(await removePasskey(db, p.id, 'nope'), false);
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, { id: 'nope', challenge: so.challenge }, { rp, now }), 'invalid');
});

test('a hidden profile cannot register or sign in', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const o = await registrationOptions(db, w, p.id, { rp, now });
  await register(db, w, p.id, { id: 'h', challenge: o.challenge }, { rp, now });
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(p.id).run();
  assert.equal(await registrationOptions(db, w, p.id, { rp, now }), 'hidden');
  const so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, { id: 'h', challenge: so.challenge }, { rp, now }), 'hidden');
});

test('a counter that goes backwards is refused', async () => {
  const db = await openTestDb(); const w = fake();
  const p = await createProfile(db, { now });
  const o = await registrationOptions(db, w, p.id, { rp, now });
  await register(db, w, p.id, { id: 'cc', challenge: o.challenge }, { rp, now });
  let so = await signinOptions(db, w, { rp, now });
  assert.ok((await signin(db, w, { id: 'cc', challenge: so.challenge, counter: 5 }, { rp, now })).key);
  w.verifyAuthenticationResponse = async () => { throw new Error('counter'); };
  so = await signinOptions(db, w, { rp, now });
  assert.equal(await signin(db, w, { id: 'cc', challenge: so.challenge, counter: 3 }, { rp, now }), 'invalid');
});
