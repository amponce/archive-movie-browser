import test from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { keyFromHash, editLink, readProfile, writeProfile, adoptFromLink } = await import('./profile.js');
const KEY = 'a'.repeat(64);

test('the key comes only from a well-formed fragment', () => {
  assert.deepEqual(keyFromHash(`#key=${KEY}`), { key: KEY });
  assert.equal(keyFromHash('#key=short'), null);
  assert.equal(keyFromHash(''), null);
});

test('edit link puts the key after #', () => {
  assert.equal(editLink('https://www.orphanedfilms.com', { id: 'abcdefghij', key: KEY }), `https://www.orphanedfilms.com/u/abcdefghij#key=${KEY}`);
});

test('an edit link replaces whatever profile this browser had', () => {
  writeProfile({ id: 'oldoldoldo', key: 'b'.repeat(64) });
  globalThis.history = { replaceState: () => {} };
  assert.equal(adoptFromLink('/u/abcdefghij', `#key=${KEY}`), true);
  assert.deepEqual(readProfile(), { id: 'abcdefghij', key: KEY });
  assert.equal(adoptFromLink('/c/abcdefghij', `#key=${KEY}`), false);
});
