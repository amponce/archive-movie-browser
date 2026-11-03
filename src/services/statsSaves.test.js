import test from 'node:test';
import assert from 'node:assert/strict';
import { savesOf, sharesOf } from '../../api/stats.js';
import { createProfile, setFavourite, createChannel } from '../../api/_community.js';
import { openTestDb } from './testDb.js';

const now = 1_700_000_000_000;

test('stats count hearts and channel films per film, leaving out hidden profiles', async () => {
  const db = await openTestDb();
  const a = await createProfile(db, { now });
  const b = await createProfile(db, { now });
  const hidden = await createProfile(db, { now });
  for (const [p, film] of [[a, 'Detour'], [b, 'Detour'], [a, 'Nosferatu'], [hidden, 'Nosferatu'], [hidden, 'Nosferatu2']]) await setFavourite(db, p.id, film, true, { now });
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(hidden.id).run();
  await createChannel(db, a.id, { name: 'One', films: [{ film: 'Detour' }, { film: 'Nosferatu' }] }, { now, flag: async () => false });
  await createChannel(db, b.id, { name: 'Two', films: [{ film: 'Detour' }] }, { now, flag: async () => false });
  const saves = await savesOf(db);
  assert.deepEqual(saves.hearted, [['Detour', 2], ['Nosferatu', 1]]);
  assert.deepEqual(saves.channels, [['Detour', 2], ['Nosferatu', 1]]);
  assert.equal(saves.totals.channels, 2);
  assert.deepEqual(await savesOf(null), { hearted: [], channels: [], totals: null });
});

test('shares put each film\'s minutes under its main genre and decade, beside how many films each has', () => {
  const films = { a: { i: 1, p: '/a', g: ['Horror', 'Comedy'], y: 1968 }, b: { i: 2, p: '/b', g: ['Western'], y: 1952 }, c: { i: 3, p: '/c', g: ['Horror'], y: 1931 } };
  const { genres, decades } = sharesOf([['a', 30], ['c', 10], ['gone', 99]], films, Object.values(films));
  assert.deepEqual(genres, [{ label: 'Horror', minutes: 40, films: 2 }, { label: 'Western', minutes: 0, films: 1 }]);
  assert.deepEqual(decades.map(d => d.label), ['1960s', '1930s', '1950s']);
});
