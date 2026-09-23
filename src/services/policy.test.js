import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isTakenDown, isRecent, TAKEN_DOWN } from './policy.js';

const FIXTURE = 'orphanedfilms-takedown-test';
const entry = (y) => ({ i: 999, t: 'Test film', y, p: '/p.jpg', c: 1, g: ['Horror'], v: 7, k: 900, l: 90, d: 90 });

test('the takedown list is well formed and keeps its test fixture', () => {
  assert.ok(isTakenDown(FIXTURE));
  for (const t of TAKEN_DOWN) assert.ok(/^[A-Za-z0-9._-]{1,200}$/.test(t.id) && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.reason, JSON.stringify(t));
});

test('a taken-down upload is gone from the index, so from rows, More like this, TV and the MCP', async () => {
  const { setPosterIndex, indexedMatch, loadPosterIndex } = await import('./posterIndex.js');
  setPosterIndex({ [FIXTURE]: entry(1950), kept: entry(1950) });
  assert.equal(await indexedMatch(FIXTURE), undefined);
  assert.ok(!(FIXTURE in await loadPosterIndex()));
  assert.ok(await indexedMatch('kept'));
});

test('a taken-down upload does not open as a film page, and is dropped from search results', async (t) => {
  const { archiveService } = await import('./archive.js');
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ metadata: { identifier: FIXTURE, title: 'Test film', mediatype: 'movies' }, files: [] }) }));
  await assert.rejects(() => archiveService.getMovieByIdentifier(FIXTURE), /blocked/);
});

test('no curated list or front-page pick holds a taken-down or recent film', () => {
  const index = JSON.parse(readFileSync(new URL('../../public/poster-index.json', import.meta.url), 'utf8')).films;
  const lists = readdirSync(new URL('../lists/', import.meta.url)).filter(f => f.endsWith('.json'));
  const ids = [
    ...lists.flatMap(f => JSON.parse(readFileSync(new URL(`../lists/${f}`, import.meta.url), 'utf8')).films.map(x => [x.id, f])),
    ...JSON.parse(readFileSync(new URL('../programme/featured.json', import.meta.url), 'utf8')).films.map(x => [x.id, 'featured.json']),
  ];
  for (const [id, where] of ids) {
    assert.ok(!isTakenDown(id), `${id} in ${where} was taken down`);
    assert.ok(!isRecent(index[id]?.y), `${id} in ${where} is from ${index[id]?.y}, too recent for the site to show on its own`);
  }
});

test('recent films stay off the front page rows and More like this', async () => {
  const { rowFor, sameShelf } = await import('./programme.js');
  const now = new Date();
  const index = { old: entry(1958), new: { ...entry(now.getFullYear() - 3), i: 1000 }, mine: { ...entry(1960), i: 1001 } };
  assert.deepEqual(rowFor(index, { limit: 10 }).map(f => f.id).sort(), ['mine', 'old']);
  assert.deepEqual(sameShelf(index, 'mine').map(f => f.id), ['old']);
  assert.ok(isRecent(now.getFullYear() - 24) && !isRecent(now.getFullYear() - 26));
});

test('the TV schedule never airs a taken-down upload', async () => {
  const src = readFileSync(new URL('../../api/_tv.js', import.meta.url), 'utf8');
  assert.match(src, /isTakenDown\(id\)/, 'record() must check the takedown list');
});

test('a taken-down upload never gets into a personal channel, from a link or from the saved list', async (t) => {
  const { channelFromUrl, shareUrl, toggleFilm } = await import('./myChannel.js');
  assert.deepEqual(channelFromUrl(`?mine=Detour,${FIXTURE},Cops1922`), ['Detour', 'Cops1922']);
  assert.ok(!shareUrl(['Detour', FIXTURE]).includes(FIXTURE));
  assert.deepEqual(toggleFilm([], FIXTURE), []);
  // The server's shared channel must not fetch it live either (the fall-through the review found)
  const { personalChannel } = await import('../../api/_tv.js');
  const fetches = [];
  t.mock.method(globalThis, 'fetch', async (url) => { fetches.push(String(url)); throw new Error('no network in tests'); });
  const channel = await personalChannel([FIXTURE]);
  assert.equal(channel.lineup.length, 0);
  assert.ok(!fetches.some(u => u.includes(FIXTURE)), 'asked Archive.org for a taken-down upload');
});

test("a taken-down upload is left out of someone's Archive.org list shown here", async () => {
  const { summarize } = await import('../../api/_archiveList.js');
  const list = summarize({ success: true, value: { list_name: 'L', is_private: false, members: [{ identifier: FIXTURE }, { identifier: 'Cops1922' }] } });
  assert.deepEqual(list.identifiers, ['Cops1922']);
});
