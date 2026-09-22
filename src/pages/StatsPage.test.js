import test from 'node:test';
import assert from 'node:assert/strict';

// The page imports React and the DOM; only the pure helper is tested here
const src = await import('node:fs').then(fs => fs.readFileSync(new URL('./StatsPage.jsx', import.meta.url), 'utf8'));
const cleanKey = new Function(`${src.match(/export const cleanKey = (.*);/)[1].replace(/^\(text\) =>/, 'return (text) =>')}`)();

test('cleanKey strips the quotes and whitespace a pasted .env value carries', () => {
  assert.equal(cleanKey('  "abc123"\n'), 'abc123');
  assert.equal(cleanKey("'abc123'"), 'abc123');
  assert.equal(cleanKey('abc123'), 'abc123');
  assert.equal(cleanKey(''), '');
});
