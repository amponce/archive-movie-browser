import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, newKey, hashKey, cleanText, cleanLines, cleanFilms, afterContentEdit, submitProblem, isListed, LIMITS, createProfile, authProfile, getProfile, updateProfile, isReservedName, setFavourite, createChannel, getChannel, updateChannel, deleteChannel, submitChannel, setSaved, listChannels, handleProblem, checkHandle, suggestHandles, movedHandle, HOLD } from '../../api/_community.js';
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
  assert.equal(cleanText('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', 80), '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}');
  assert.equal(cleanText('\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645', 80), '\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645');
  assert.equal(cleanText('a\u200Bb\u202Ec', 80), 'abc');
});

test('text loses C1 controls, zero-width, bidi and byte-order characters', () => {
  assert.equal(cleanText('a\u0085b\u009fc', 80), 'a b c');
  assert.equal(cleanText('a\u200bb\u200cc\u200dd\u200ee\u200ff', 80), 'ab\u200cc\u200ddef');
  assert.equal(cleanText('\u202aa\u202bb\u202cc\u202dd\u202ee', 80), 'abcde');
  assert.equal(cleanText('\u2066a\u2067b\u2068c\u2069', 80), 'abc');
  assert.equal(cleanText('\ufeffname\ufeff', 80), 'name');
  assert.equal(cleanText('\u200b \u202e ', 80), '');
});

test('a description keeps its line breaks and nothing else invisible', () => {
  assert.equal(cleanLines('First line\nsecond\r\nthird', 500), 'First line\nsecond\nthird');
  assert.equal(cleanLines('a\n\n\n\n\nb', 500), 'a\n\nb');
  assert.equal(cleanLines('a\n \t \n\n b', 500), 'a\n\nb');
  assert.equal(cleanLines('\n\n  a\u0000b\u200b\u202ec\tx  \n\n', 500), 'a bc x');
  assert.equal(cleanLines('x'.repeat(300) + '\n' + 'y'.repeat(300), 500).length, 500);
  assert.equal(cleanLines(null, 500), '');
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
  assert.equal(await submitChannel(db, id, pid, { now, flag: noFlag }), 'not-agreed');
  await updateProfile(db, pid, { agreed: true }, { now });
  assert.equal(await submitChannel(db, id, pid, { now, flag: noFlag }), null);
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

test('a profile lists its channels oldest first, without their times', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const first = await createChannel(db, pid, { name: 'First', films: films(1) }, { now, flag: noFlag });
  const second = await createChannel(db, pid, { name: 'Second', films: films(1) }, { now: now + 1000, flag: noFlag });
  await updateChannel(db, first, pid, { name: 'First, edited' }, { now: now + 2000, flag: noFlag });
  const { channels } = await getProfile(db, pid);
  assert.deepEqual(channels.map(c => c.id), [first, second]);
  assert.ok(channels.every(c => !('created' in c) && !('updated' in c)));
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

test('reorder re-checks no film; a new film is checked once; reorder keeps a public channel public', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  let calls = 0;
  const flag = async () => { calls++; return false; };
  const id = await createChannel(db, pid, { name: 'R', films: films(3) }, { now, flag });
  await db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  calls = 0;
  await updateChannel(db, id, pid, { films: [{ film: 'film-2' }, { film: 'film-1' }, { film: 'film-0' }] }, { now, flag });
  assert.equal(calls, 0);
  assert.equal((await getChannel(db, id)).status, 'public');
  await updateChannel(db, id, pid, { films: [{ film: 'film-2' }, { film: 'film-1' }, { film: 'film-0' }, { film: 'new' }] }, { now, flag });
  assert.equal(calls, 1);
  assert.equal((await getChannel(db, id)).status, 'submitted');
  await db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  await updateChannel(db, id, pid, { films: [{ film: 'film-2', note: 'x' }, { film: 'film-1' }, { film: 'film-0' }, { film: 'new' }] }, { now, flag });
  assert.equal((await getChannel(db, id)).status, 'submitted');
});

test('submit re-checks flagged films: cleared ones pass, forbidden ones are dropped', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  await updateProfile(db, pid, { agreed: true }, { now });
  const id = await createChannel(db, pid, { name: 'S', films: films(6) }, { now, flag: async f => f === 'film-0' || f === 'film-1' });
  assert.equal(await submitChannel(db, id, pid, { now, flag: async () => true }), 'flagged');
  assert.equal(await submitChannel(db, id, pid, { now, flag: async f => (f === 'film-1' ? 'forbidden' : false) }), null);
  assert.deepEqual((await getChannel(db, id)).films.map(f => f.film), ['film-0', 'film-2', 'film-3', 'film-4', 'film-5']);
});

test('a name or description equal to the stored one is not a content edit', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name: 'Same', description: 'Words', films: films(2) }, { now, flag: noFlag });
  await db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  await updateChannel(db, id, pid, { name: '  Same  ', description: ' Words ' }, { now, flag: noFlag });
  assert.equal((await getChannel(db, id)).status, 'public');
  await updateChannel(db, id, pid, { name: 'different' }, { now, flag: noFlag });
  assert.equal((await getChannel(db, id)).status, 'submitted');
});

test('a channel description is stored with its line breaks, on create and on edit', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name: 'Lines', description: 'One\n\n\n\nTwo', films: films(1) }, { now, flag: noFlag });
  assert.equal((await getChannel(db, id)).description, 'One\n\nTwo');
  await updateChannel(db, id, pid, { description: 'Three\nFour' }, { now, flag: noFlag });
  assert.equal((await getChannel(db, id)).description, 'Three\nFour');
});

const GONE = TAKEN_DOWN[0].id;
const addRow = (db, id, film, pos, flagged = 0) => db.prepare('INSERT INTO channel_films (channel_id, film_id, position, note, flagged) VALUES (?, ?, ?, ?, ?)').bind(id, film, pos, '', flagged).run();

test('a taken-down film does not count toward the five needed to submit', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  await updateProfile(db, pid, { agreed: true }, { now });
  const id = await createChannel(db, pid, { name: 'T', films: films(4) }, { now, flag: noFlag });
  await addRow(db, id, GONE, 4);
  assert.equal(await submitChannel(db, id, pid, { now, flag: noFlag }), 'too-few');
});

test('a flagged row whose film is taken down does not block submit', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  await updateProfile(db, pid, { agreed: true }, { now });
  const id = await createChannel(db, pid, { name: 'T', films: films(5) }, { now, flag: noFlag });
  await addRow(db, id, GONE, 5, 1);
  assert.equal(await submitChannel(db, id, pid, { now, flag: async () => true }), null);
});

test('reordering the visible films of a public channel with a taken-down row keeps it public', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name: 'T', films: films(5) }, { now, flag: noFlag });
  await addRow(db, id, GONE, 5);
  await db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  await updateChannel(db, id, pid, { films: films(5).reverse() }, { now, flag: noFlag });
  assert.equal((await getChannel(db, id)).status, 'public');
});

test('the listing leaves out a channel with no visible films and does not expose the score', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const empty = await createChannel(db, pid, { name: 'Empty', films: [] }, { now, flag: noFlag });
  await addRow(db, empty, GONE, 0);
  const full = await createChannel(db, pid, { name: 'Full', films: films(5) }, { now, flag: noFlag });
  await db.prepare("UPDATE channels SET status = 'public'").run();
  const list = await listChannels(db, { minutes: async () => ({}) });
  assert.deepEqual(list.map(c => c.id), [full]);
  assert.equal('score' in list[0], false);
});

// An invented identifier whose words the filter refuses (no such upload)
const REFUSED = 'test_snuff-film.upload';

test('a film the filter refuses is never a favourite or a channel film, with no lookup', async () => {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  assert.equal(await setFavourite(db, pid, REFUSED, true, { now }), false);
  assert.deepEqual((await getProfile(db, pid)).favourites, []);
  assert.deepEqual(cleanFilms([{ film: REFUSED }, { film: 'Detour' }]).map(f => f.film), ['Detour']);
  const asked = [];
  const flag = async f => { asked.push(f); return false; };
  const id = await createChannel(db, pid, { name: 'R', films: [{ film: REFUSED }, { film: 'film-0' }] }, { now, flag });
  assert.deepEqual((await getChannel(db, id)).films.map(f => f.film), ['film-0']);
  assert.deepEqual(asked, ['film-0']);
});

test('text loses filler characters that render blank', () => {
  assert.equal(cleanText('ㅤᅟᅠﾠ⠀', 80), '');
  assert.equal(cleanText('aㅤb', 80), 'ab');
});

test("a hidden owner's channel is neither shown nor savable under other profiles", async () => {
  const db = await openTestDb();
  const { id: owner } = await createProfile(db, { now });
  const { id: fan } = await createProfile(db, { now });
  const id = await createChannel(db, owner, { name: 'X', films: films(1) }, { now, flag: noFlag });
  assert.equal(await setSaved(db, fan, id, true, { now }), true);
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(owner).run();
  assert.deepEqual((await getProfile(db, fan)).saved, []);
  await setSaved(db, fan, id, false, { now });
  assert.equal(await setSaved(db, fan, id, true, { now }), false);
});

test('names that look like the site or its staff are reserved', () => {
  for (const n of ['Orphaned Films', 'orphanedfilms', 'Orphaned-Films Team', 'ADMIN', 'Mod', 'moderator42', 'Staff picks', 'Official', 'support', 'team', 'System']) assert.equal(isReservedName(n), true, n);
  for (const n of ['Midnight Projector', 'Modern Times fan', 'The Teamsters', 'Night Owl']) assert.equal(isReservedName(n), false, n);
});

test('handles: shape, id-shaped, reserved and refused words', () => {
  assert.equal(handleProblem('midnight-projector'), null);
  for (const h of ['ab', 'Abc', 'a--b', '-abc', 'abcdefghij', 'x'.repeat(31), '']) assert.equal(handleProblem(h), 'invalid', h);
  assert.equal(handleProblem('abcdefgh1j'), null, 'not id-shaped: 1 is not in the alphabet');
  for (const h of ['admin', 'orphanedfilms-tv', 'the-staff', 'support']) assert.equal(handleProblem(h), 'reserved', h);
  assert.equal(handleProblem('rape-films'), 'reserved');
});

test('handles: set, read by handle, unique whatever the case', async () => {
  const db = await openTestDb();
  const a = await createProfile(db, { now });
  const b = await createProfile(db, { now });
  assert.equal(await updateProfile(db, a.id, { handle: '  Night-Owl ' }, { now }), undefined);
  assert.equal((await getProfile(db, a.id)).handle, 'night-owl');
  assert.equal((await getProfile(db, 'night-owl')).id, a.id);
  assert.equal((await getProfile(db, 'NIGHT-OWL')).id, a.id);
  assert.equal((await getProfile(db, b.id)).handle, null);
  assert.equal(await updateProfile(db, b.id, { handle: 'NIGHT-OWL' }, { now }), 'taken');
  assert.equal(await updateProfile(db, b.id, { handle: 'admin' }, { now }), 'reserved');
  assert.equal(await updateProfile(db, b.id, { handle: b.id }, { now }), 'invalid');
  assert.equal(await updateProfile(db, a.id, { handle: 'night-owl', name: 'Owl' }, { now }), undefined, 'the same handle again is no change');
  assert.equal((await getProfile(db, a.id)).name, 'Owl');
  await assert.rejects(db.prepare("UPDATE profiles SET handle = 'Night-Owl' WHERE id = ?").bind(b.id).run(), /UNIQUE/);
});

test('handles: two claims at once, one wins and the other is taken', async () => {
  const db = await openTestDb();
  const a = await createProfile(db, { now });
  const b = await createProfile(db, { now });
  const out = await Promise.all([a, b].map(p => updateProfile(db, p.id, { handle: 'reel' }, { now })));
  assert.deepEqual(out.sort(), ['taken', undefined].sort());
  assert.ok([a.id, b.id].includes((await getProfile(db, 'reel')).id));
});

test('handles: a changed handle is held and redirects for 30 days, then anyone can claim it', async () => {
  const db = await openTestDb();
  const a = await createProfile(db, { now });
  const b = await createProfile(db, { now });
  await updateProfile(db, a.id, { handle: 'first' }, { now });
  await updateProfile(db, a.id, { handle: 'second' }, { now });
  assert.equal(await getProfile(db, 'first'), null);
  assert.equal(await movedHandle(db, 'first', now + 1), 'second');
  await updateProfile(db, a.id, { handle: 'third' }, { now: now + 2 });
  assert.equal(await movedHandle(db, 'first', now + 3), 'third', 'an older handle leads to the current one');
  assert.equal(await updateProfile(db, b.id, { handle: 'first' }, { now: now + 4 }), 'taken');
  assert.deepEqual(await checkHandle(db, 'first', null, now + 4), { available: false, reason: 'taken', suggestions: ['first2', 'first_films', 'first-tv'] });
  assert.deepEqual(await checkHandle(db, 'first', a.id, now + 4), { available: true }, 'free to its own profile');
  const later = now + HOLD + 1;
  assert.equal(await movedHandle(db, 'first', later), null);
  assert.deepEqual(await checkHandle(db, 'first', null, later), { available: true });
  assert.equal(await updateProfile(db, b.id, { handle: 'first' }, { now: later }), undefined);
  assert.equal((await getProfile(db, 'first')).id, b.id);
});

test('handles: the owner takes a held handle back; removal leads back to the id', async () => {
  const db = await openTestDb();
  const a = await createProfile(db, { now });
  await updateProfile(db, a.id, { handle: 'first' }, { now });
  await updateProfile(db, a.id, { handle: 'second' }, { now });
  assert.equal(await updateProfile(db, a.id, { handle: 'first' }, { now: now + 1 }), undefined);
  assert.equal((await getProfile(db, 'first')).id, a.id);
  assert.equal(await movedHandle(db, 'second', now + 2), 'first');
  assert.equal(await movedHandle(db, 'first', now + 2), null, 'its own hold is gone');
  assert.equal(await updateProfile(db, a.id, { handle: null }, { now: now + 3 }), undefined);
  assert.equal((await getProfile(db, a.id)).handle, null);
  assert.equal(await getProfile(db, 'first'), null);
  assert.equal(await movedHandle(db, 'first', now + 4), a.id);
  assert.equal(await movedHandle(db, 'second', now + 4), a.id);
  assert.equal(await updateProfile(db, a.id, { handle: '' }, { now: now + 5 }), undefined, 'removing nothing is no change');
});

test('handles: a hidden profile is not found by handle, old or current', async () => {
  const db = await openTestDb();
  const a = await createProfile(db, { now });
  await updateProfile(db, a.id, { handle: 'gone-old' }, { now });
  await updateProfile(db, a.id, { handle: 'gone' }, { now });
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(a.id).run();
  assert.equal(await getProfile(db, 'gone'), null);
  assert.equal(await movedHandle(db, 'gone-old', now + 1), null);
});

test('handles: suggestions skip taken, held and refused variants', async () => {
  const db = await openTestDb();
  const ps = await Promise.all(Array.from({ length: 4 }, () => createProfile(db, { now })));
  await updateProfile(db, ps[0].id, { handle: 'reel' }, { now });
  await updateProfile(db, ps[1].id, { handle: 'reel2' }, { now });
  await updateProfile(db, ps[2].id, { handle: 'reel_films' }, { now });
  await updateProfile(db, ps[2].id, { handle: 'reel-other' }, { now });
  assert.deepEqual(await suggestHandles(db, 'reel', null, now), ['reel3', 'reel-tv', 'reel4']);
  assert.deepEqual(await suggestHandles(db, 'reel', ps[2].id, now), ['reel3', 'reel_films', 'reel-tv'], 'a hold of its own is free');
  assert.ok((await suggestHandles(db, 'abcdefghi', null, now)).every(h => !/^[a-z2-7]{10}$/.test(h)), 'never id-shaped');
});
