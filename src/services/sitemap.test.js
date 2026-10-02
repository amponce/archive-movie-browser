import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { createProfile, createChannel } from '../../api/_community.js';
import { sitemap, listedChannelPaths } from '../../api/sitemap.js';

test('the sitemap lists the community page and listed channels only', async () => {
  const db = await openTestDb();
  const now = 1_800_000_000_000;
  const { id: pid } = await createProfile(db, { now });
  const films = Array.from({ length: 5 }, (_, i) => ({ film: `film-${i}` }));
  const make = async (status) => {
    const id = await createChannel(db, pid, { name: status, films }, { now, flag: async () => false });
    await db.prepare('UPDATE channels SET status = ? WHERE id = ?').bind(status, id).run();
    return id;
  };
  const pub = await make('public'); const feat = await make('featured'); const unl = await make('unlisted'); const sub = await make('submitted');
  const paths = await listedChannelPaths(db);
  assert.deepEqual(new Set(paths), new Set([`/c/${pub}`, `/c/${feat}`]));
  const xml = sitemap(paths);
  assert.match(xml, /\/channels</);
  assert.match(xml, new RegExp(`/c/${pub}<`));
  assert.doesNotMatch(xml, new RegExp(unl));
  assert.doesNotMatch(xml, new RegExp(sub));
});

test('without a database the sitemap still has the site pages', async () => {
  assert.deepEqual(await listedChannelPaths(undefined), []);
  const broken = { prepare: () => { throw new Error('down'); } };
  assert.deepEqual(await listedChannelPaths(broken), []);
  assert.match(sitemap([]), /\/browse</);
});
