import test from 'node:test';
import assert from 'node:assert/strict';
import { newId, newKey, hashKey, cleanText, cleanFilms, afterContentEdit, submitProblem, isListed, LIMITS } from '../../api/_community.js';

test('ids and keys have the agreed shape', async () => {
  assert.match(newId(), /^[a-z2-7]{10}$/);
  assert.notEqual(newId(), newId());
  const key = newKey();
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.match(await hashKey(key), /^[0-9a-f]{64}$/);
  assert.equal(await hashKey('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('text is trimmed, flattened and cut to its limit', () => {
  assert.equal(cleanText('  a\n\tb\u0000c  ', 80), 'a b c');
  assert.equal(cleanText('x'.repeat(100), 80).length, 80);
  assert.equal(cleanText(null, 80), '');
});

test('films: valid ids only, once each, taken-down out, capped, notes cut', () => {
  const films = cleanFilms([{ film: 'Detour' }, { film: 'Detour' }, { film: '<x>' }, { film: 'ok-1', note: 'n'.repeat(400) }]);
  assert.deepEqual(films.map(f => f.film), ['Detour', 'ok-1']);
  assert.equal(films[1].note.length, LIMITS.note);
  assert.equal(cleanFilms(Array.from({ length: 60 }, (_, i) => ({ film: `f${i}` }))).length, LIMITS.films);
});

test('editing a listed channel sends it back to review', () => {
  assert.equal(afterContentEdit('public'), 'submitted');
  assert.equal(afterContentEdit('featured'), 'submitted');
  assert.equal(afterContentEdit('unlisted'), 'unlisted');
  assert.equal(afterContentEdit('hidden'), 'hidden');
});

test('submit needs five films, no flagged film, not hidden', () => {
  assert.equal(submitProblem({ films: 4, flagged: 0, status: 'unlisted' }), 'too-few');
  assert.equal(submitProblem({ films: 5, flagged: 1, status: 'unlisted' }), 'flagged');
  assert.equal(submitProblem({ films: 5, flagged: 0, status: 'hidden' }), 'hidden');
  assert.equal(submitProblem({ films: 5, flagged: 0, status: 'unlisted' }), null);
  assert.ok(isListed('public') && isListed('featured') && !isListed('submitted') && !isListed('unlisted'));
});
