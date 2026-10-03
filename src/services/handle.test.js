import test from 'node:test';
import assert from 'node:assert/strict';
import { HANDLE, cleanHandle, toHandle, handleVariants } from './handle.js';

test('a handle is 3 to 30 lowercase letters, digits and single separators inside', () => {
  for (const h of ['abc', 'midnight-projector', 'reel_2', 'a1b', 'x'.repeat(30)]) assert.ok(HANDLE.test(h), h);
  for (const h of ['ab', 'x'.repeat(31), 'Abc', '-abc', 'abc-', 'a--b', 'a_-b', 'a b', 'ab.c', 'abé']) assert.ok(!HANDLE.test(h), h);
  assert.equal(cleanHandle('  Night-Owl '), 'night-owl');
});

test('any text becomes a handle shape, or nothing', () => {
  assert.equal(toHandle('Jason.Scott'), 'jason-scott');
  assert.equal(toHandle('__a..b__'), 'a-b');
  assert.equal(toHandle('...'), '');
  assert.equal(toHandle(`${'a'.repeat(29)}.b`), 'a'.repeat(29));
});

test('variants are numbered, then _films and -tv, cut to 30 characters', () => {
  assert.deepEqual(handleVariants('night'), ['night2', 'night3', 'night4', 'night5', 'night6', 'night7', 'night8', 'night9', 'night_films', 'night-tv']);
  const long = handleVariants(`${'a'.repeat(23)}-${'b'.repeat(6)}`);
  assert.ok(long.every(h => h.length <= 30 && HANDLE.test(h)), long.join());
  assert.equal(long[8], `${'a'.repeat(23)}_films`);
});
