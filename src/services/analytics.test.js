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
