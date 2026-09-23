import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleFilm, hasFilm, channelFromUrl, shareUrl } from './myChannel.js';

test('toggleFilm adds a film once and removes it again', () => {
  let ids = [];
  ids = toggleFilm(ids, 'Detour'); ids = toggleFilm(ids, 'Detour'); ids = toggleFilm(ids, 'Detour');
  assert.deepEqual(ids, ['Detour']);
  assert.ok(hasFilm(ids, 'Detour'));
  assert.deepEqual(toggleFilm(ids, 'Detour'), []);
});

test('a channel survives the round trip through a link, junk left out', () => {
  const ids = ['Detour', 'CarnivalOfSouls1962', 'the-lady-vanishes-1938'];
  const url = shareUrl(ids, 'https://www.orphanedfilms.com');
  assert.equal(url, 'https://www.orphanedfilms.com/tv?mine=Detour,CarnivalOfSouls1962,the-lady-vanishes-1938');
  assert.deepEqual(channelFromUrl(new URL(url).search), ids);
  assert.deepEqual(channelFromUrl('?mine=a,<script>,b,,a'), ['a', 'b']);
  assert.equal(channelFromUrl('?genre=Horror'), null);
});

test('adding from a page that opened before other films were added keeps every film', async () => {
  const store = {};
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  const { toggleSaved, removeSaved, readMyChannel } = await import('./myChannel.js');
  // Two tabs are open. Tab B loaded while the channel was still empty.
  toggleSaved('big-trouble-little-china'); // added in tab A
  toggleSaved('uhf.-1989'); // added in tab B, which never saw tab A's film
  assert.deepEqual(readMyChannel(), ['big-trouble-little-china', 'uhf.-1989']);
  assert.deepEqual(toggleSaved('uhf.-1989'), ['big-trouble-little-china'], 'a second press takes it off again');
  toggleSaved('alligator-1980');
  assert.deepEqual(removeSaved('big-trouble-little-china'), ['alligator-1980']);
  delete globalThis.localStorage;
});
