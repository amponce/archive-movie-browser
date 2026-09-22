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
