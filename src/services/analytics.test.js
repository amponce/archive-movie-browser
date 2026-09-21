import test from 'node:test';
import assert from 'node:assert/strict';
import { eventData } from './analytics.js';

test('eventData keeps events small, flat and free of anything personal', () => {
  assert.deepEqual(eventData({ film: 'Cops1922', player: 'own' }), { film: 'Cops1922', player: 'own' });
  assert.deepEqual(eventData({ query: '  Night Of The LIVING dead  ' }), { query: 'night of the living dead' });
  assert.equal(eventData({ query: 'x'.repeat(200) }).query.length, 60);
  assert.deepEqual(eventData({ type: 'decade', value: 1980, extra: 'dropped', more: 'dropped' }), { type: 'decade', value: 1980 }, 'two properties at most: the plan limit');
  assert.deepEqual(eventData({ film: undefined, page: null, ok: true }), { ok: true });
  assert.deepEqual(eventData({ query: 'someone@example.com found this' }), { query: '[email] found this' }, 'an email typed into search never leaves the browser');
  assert.deepEqual(eventData(), {});
});

test('referrerHost keeps the site someone came from and nothing else', async () => {
  const { referrerHost } = await import('./analytics.js');
  assert.equal(referrerHost('https://news.ycombinator.com/item?id=123', 'archive-movie-browser.vercel.app'), 'news.ycombinator.com');
  assert.equal(referrerHost('https://www.google.com/search?q=private+words', 'x.app'), 'google.com');
  assert.equal(referrerHost('https://archive-movie-browser.vercel.app/mcp.html', 'archive-movie-browser.vercel.app'), '', 'moving around our own site is not a referral');
  assert.equal(referrerHost('', 'x.app'), '');
  assert.equal(referrerHost('not a url', 'x.app'), '');
});
