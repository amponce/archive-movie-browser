import test from 'node:test';
import assert from 'node:assert/strict';
import { channelView, channelLink } from './channelView.js';

test('the link chooses the view, then this browser, then watching', () => {
  assert.equal(channelView('?view=list', null), 'list');
  assert.equal(channelView('?view=watch', 'list'), 'watch');
  assert.equal(channelView('', 'list'), 'list');
  assert.equal(channelView('', null), 'watch');
  assert.equal(channelView('?view=junk', 'junk'), 'watch');
});

test('a copied link carries the list view only when in it', () => {
  assert.equal(channelLink('https://x.com', 'abc', 'list'), 'https://x.com/c/abc?view=list');
  assert.equal(channelLink('https://x.com', 'abc', 'watch'), 'https://x.com/c/abc');
});
