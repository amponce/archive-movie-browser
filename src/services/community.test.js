import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, newKey, hashKey, cleanText, cleanFilms, afterContentEdit, submitProblem, isListed, LIMITS, createProfile, authProfile, getProfile, updateProfile, setFavourite, createChannel, getChannel, updateChannel, deleteChannel, submitChannel, setSaved, listChannels } from '../../api/_community.js';
import { openTestDb } from './testDb.js';
import { TAKEN_DOWN } from './policy.js';

test('ids and keys have the agreed shape', async () => {
  assert.match(newId(), /^[a-z2-7]{10}$/);
  assert.notEqual(newId(), newId());
  const key = newKey();
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.match(await hashKey(key), /^[0-9a-f]{64}$/);
  assert.equal(await hashKey('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('text is trimmed, flattened and cut to its limit', () => {
  assert.equal(cleanText('  a\n\tb\u0000c  ', 80), 'a b c');
  assert.equal(cleanText('x'.repeat(100), 80).length, 80);
  assert.equal(cleanText(null, 80), '');
});

test('films: valid ids only, once each, taken-down out, capped, notes cut', () => {
  const films = cleanFilms([{ film: 'Detour' }, { film: 'Detour' }, { film: '<x>' }, { film: 'ok-1', note: 'n'.repeat(400) }]);
  assert.deepEqual(films.map(f => f.film), ['Detour', 'ok-1']);
  assert.equal(films[1].note.length, LIMITS.note);
  assert.equal(cleanFilms(Array.from({ length: 60 }, (_, i) => ({ film: `f${i}` }))).length, LIMITS.films);
});

test('editing a listed channel sends it back to review', () => {
  assert.equal(afterContentEdit('public'), 'submitted');
  assert.equal(afterContentEdit('featured'), 'submitted');
  assert.equal(afterContentEdit('unlisted'), 'unlisted');
  assert.equal(afterContentEdit('hidden'), 'hidden');
});

test('submit needs five films, no flagged film, not hidden', () => {
  assert.equal(submitProblem({ films: 4, flagged: 0, status: 'unlisted' }), 'too-few');
  assert.equal(submitProblem({ films: 5, flagged: 1, status: 'unlisted' }), 'flagged');
  assert.equal(submitProblem({ films: 5, flagged: 0, status: 'hidden' }), 'hidden');
  assert.equal(submitProblem({ films: 5, flagged: 0, status: 'unlisted' }), null);
  assert.ok(isListed('public') && isListed('featured') && !isListed('submitted') && !isListed('unlisted'));
});

const now = 1_700_000_000_000;
const noFlag = async () => false;
const films = n => Array.from({ length: n }, (_, i) => ({ film: `film-${i}` }));

test('profile: create, auth with the key only, edit', async () => {
  const db = await openTestDb();
  const { id, key } = await createProfile(db, { now });
  assert.ok(await authProfile(db, id, key));
  assert.equal(await authProfile(db, id, 'wrong'), null);
  await updateProfile(db, id, { name: '  Midnight  Projector ', archiveUser: 'jason_scott' }, { now });
  const p = await getProfile(db, id);
  assert.equal(p.name, 'Midnight Projector');
  assert.equal(p.archiveUser, 'jason_scott');
});

test('favourites toggle and refuse junk', async () => {
  const db = await openTestDb();
  const { id } = await createProfile(db, { now });
  assert.equal(await setFavourite(db, id, 'Detour', true, { now }), true);
  assert.equal(await setFavourite(db, id, '<bad>', true, { now }), false);
  assert.deepEqual((await getProfile(db, id)).favourites, ['Detour']);
  await setFavourite(db, id, 'Detour', false, { now });
  assert.deepEqual((await getProfile(db, id)).favourites, []);
});

test('channel: create, read in order with notes and flags, owner only edits', async () => {
  const db = await openTestDb();
  const a = await createProfile(db, { now });
  const b = await createProfile(db, { now });
  const flag = async film => film === 'film-2';
  const id = await createChannel(db, a.id, { name: 'Night Shift', films: [{ film: 'film-1', note: 'start here' }, { film: 'film-2' }] }, { now, flag });
  let c = await getChannel(db, id);
  assert.deepEqual(c.films, [{ film: 'film-1', note: 'start here', flagged: false }, { film: 'film-2', note: '', flagged: true }]);
  assert.equal(c.status, 'unlisted');
  assert.equal(await updateChannel(db, id, b.id, { name: 'Mine now' }, { now, flag }), false);
  assert.equal(await updateChannel(db, id, a.id, { films: [{ film: 'film-2' }, { film: 'film-1' }] }, { now, flag }), true);
  c = await getChannel(db, id);
  assert.deepEqual(c.films.map(f => f.film), ['film-2', 'film-1']);
});

test('submit: agreement, five films, no flagged; listed after approval; edit unlists', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name: 'Five', films: films(5) }, { now, flag: noFlag });
  assert.equal(await submitChannel(db, id, pid, { now }), 'not-agreed');
  await updateProfile(db, pid, { agreed: true }, { now });
  assert.equal(await submitChannel(db, id, pid, { now }), null);
  assert.equal((await getChannel(db, id)).status, 'submitted');
  await db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  assert.equal((await listChannels(db, { minutes: async () => ({}) })).length, 1);
  await updateChannel(db, id, pid, { description: 'changed' }, { now, flag: noFlag });
  assert.equal((await getChannel(db, id)).status, 'submitted');
  assert.equal((await listChannels(db, { minutes: async () => ({}) })).length, 0);
});

test('listing never shows unlisted, submitted, hidden or flagged channels; ranks by saves and minutes', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const make = async (name, status, flag = noFlag) => {
    const id = await createChannel(db, pid, { name, films: films(5) }, { now, flag });
    await db.prepare('UPDATE channels SET status = ? WHERE id = ?').bind(status, id).run();
    return id;
  };
  const pub = await make('Public', 'public');
  const busy = await make('Busy', 'public');
  const feat = await make('Featured', 'featured');
  await make('Unlisted', 'unlisted'); await make('Submitted', 'submitted'); await make('Hidden', 'hidden');
  await make('Flagged', 'public', async f => f === 'film-0');
  const fan = await createProfile(db, { now });
  await setSaved(db, fan.id, pub, true, { now });
  const list = await listChannels(db, { minutes: async () => ({ [`c-${busy}`]: 500 }) });
  assert.deepEqual(list.map(c => c.id), [feat, busy, pub]);
});

test('a hidden profile hides its channels and cannot edit', async () => {
  const db = await openTestDb();
  const { id: pid, key } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name: 'X', films: films(1) }, { now, flag: noFlag });
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(pid).run();
  assert.equal(await getChannel(db, id), null);
  assert.equal(await authProfile(db, pid, key), null);
});

test('delete removes the channel and its films', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name: 'Gone', films: films(3) }, { now, flag: noFlag });
  assert.equal(await deleteChannel(db, id, pid), true);
  assert.equal(await getChannel(db, id), null);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM channel_films').first()).n, 0);
});

test('listing and profile counts leave removed films out', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name: 'Five', films: films(5) }, { now, flag: noFlag });
  await db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  await db.prepare('UPDATE channel_films SET film_id = ? WHERE channel_id = ? AND position = 0').bind(TAKEN_DOWN[0].id, id).run();
  const [c] = await listChannels(db, { minutes: async () => ({}) });
  assert.equal(c.films, 4);
  assert.equal(c.firstFilm, 'film-1');
  assert.equal((await getProfile(db, pid)).channels[0].films, 4);
});

test('forbidden films are never stored; positions stay contiguous', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const flag = async film => (film === 'film-1' ? 'forbidden' : film === 'film-2');
  const id = await createChannel(db, pid, { name: 'F', films: films(4) }, { now, flag });
  let c = await getChannel(db, id);
  assert.deepEqual(c.films.map(f => [f.film, f.flagged]), [['film-0', false], ['film-2', true], ['film-3', false]]);
  await updateChannel(db, id, pid, { films: [{ film: 'film-3' }, { film: 'film-1' }, { film: 'film-0' }] }, { now, flag });
  c = await getChannel(db, id);
  assert.deepEqual(c.films.map(f => f.film), ['film-3', 'film-0']);
  const pos = (await db.prepare('SELECT position FROM channel_films WHERE channel_id = ? ORDER BY position').bind(id).all()).results.map(r => r.position);
  assert.deepEqual(pos, [0, 1]);
});

test('a removed favourite can still be unsaved', async () => {
  const db = await openTestDb();
  const { id } = await createProfile(db, { now });
  await db.prepare('INSERT INTO favourites (profile_id, film_id, created) VALUES (?, ?, ?)').bind(id, TAKEN_DOWN[0].id, now).run();
  assert.equal(await setFavourite(db, id, TAKEN_DOWN[0].id, false, { now }), true);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM favourites').first()).n, 0);
});
