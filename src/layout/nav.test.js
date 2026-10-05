import test from 'node:test';
import assert from 'node:assert/strict';
import { navFor } from './nav.js';

test('the nav leads to 31 Days of Horror through October only, Pacific time', () => {
  const has = now => navFor(now).some(([href]) => href === '/halloween');
  assert.equal(has(new Date('2026-09-30T23:59:00-07:00')), false);
  assert.equal(has(new Date('2026-10-01T00:00:00-07:00')), true);
  assert.equal(has(new Date('2026-10-31T23:59:00-07:00')), true);
  assert.equal(has(new Date('2026-11-01T00:00:00-07:00')), false);
});
