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

test('what never appears: children in a sexual context, sexual violence, real killing, hate', async () => {
  const { isForbidden, isForbiddenSearch } = await import('./policy.js');
  // Children and sex, in any field, however it is spelled
  for (const item of [
    { title: 'Some Lolicon Collection' },
    { title: 'Anime OVA', tags: ['shotacon'] },
    { title: 'Maladolescenza (1977)' },
    { title: 'Schoolgirl hentai episode 3' },
    { title: 'Home video', description: 'nude kids at the beach' },
    { title: 'Clip', description: 'a 12 yo in an erotic scene' },
  ]) assert.equal(isForbidden(item), true, JSON.stringify(item));
  // Sexual violence, real killing, hate: in a title, or with adult content
  for (const item of [
    { title: 'Please R*pe Me! All Episodes' },
    { title: 'Real Beheading Video' },
    { title: 'Race War rally 1993' },
    { title: 'Landser Ran an den Feind', tags: ['Landser', 'White Power', 'Rac', 'Oi!', 'Skinhead'] },
    { title: 'RAC, WPWW, nazi skinhead music', subject: 'Nazi Skinhead; WPWW; RAC; white power bands' },
    { title: 'Hentai OVA', tags: ['rape', 'hentai'] },
    { title: 'Episode 4', description: 'Uncensored. Contains non-consensual scenes.' },
  ]) assert.equal(isForbidden(item), true, JSON.stringify(item));
  // Serious films and ordinary adult films stay
  for (const item of [
    { title: 'The Virgin Spring', description: "Bergman's medieval tale of a girl's rape and her father's revenge.", tags: ['drama'] },
    { title: 'Nuremberg: Its Lesson for Today', description: 'Footage of the executions of war criminals', tags: ['documentary', 'history'] },
    { title: 'Kids', tags: ['comedy'] },
    { title: 'Kakutou Ryouri Densetsu Bistro Recipe', tags: ['anime', 'fighting foodons', 'bistro recipe', 'uncut anime', 'vhs rip'] },
    { title: 'Skinheads: a documentary', description: 'How the white power movement recruited teenagers in the 1980s.', tags: ['documentary'] },
    { title: 'Emmanuelle', tags: ['erotic', 'adults only'] },
    { title: 'Children of the Corn', tags: ['horror'] },
    { title: 'Lolita (1962)', tags: ['drama'] },
    { title: 'Night of the Living Dead', tags: ['horror', 'zombies', 'gore'] },
  ]) assert.equal(isForbidden(item), false, JSON.stringify(item));
  // Searches
  for (const q of ['lolicon', 'loli hentai', 'schoolgirl sex', 'r*pe', 'rape', 'snuff film', 'beheading', 'white power', 'child porn', '13 years old nude']) assert.equal(isForbiddenSearch(q), true, q);
  for (const q of ['kids', 'the virgin spring', 'playboy', 'adults only', 'children of the corn', 'lolita', 'war crimes documentary', 'grapes of wrath']) assert.equal(isForbiddenSearch(q), false, q);
});
