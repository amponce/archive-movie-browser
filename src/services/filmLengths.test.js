import test from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { measureEach, rememberLength, readLengths, LENGTHS_KEY } = await import('./filmLengths.js');

test('measures at most six films at a time, and all of them', async () => {
  let running = 0, most = 0;
  const seen = [];
  const measure = async (id) => { running++; most = Math.max(most, running); await new Promise(r => setTimeout(r, 5)); running--; return { seconds: id.length }; };
  const ids = Array.from({ length: 40 }, (_, i) => `film${i}`);
  await measureEach(ids, measure, (id, entry) => seen.push([id, entry]));
  assert.equal(most, 6);
  assert.equal(seen.length, 40);
  assert.deepEqual(new Set(seen.map(s => s[0])), new Set(ids));
});

test('each result is reported as it lands, a failure as null', async () => {
  const order = [];
  const measure = async (id) => {
    if (id === 'bad') throw new Error('down');
    await new Promise(r => setTimeout(r, id === 'slow' ? 30 : 1));
    return { seconds: 1 };
  };
  await measureEach(['slow', 'fast', 'bad'], measure, (id, entry) => order.push([id, entry]));
  assert.deepEqual(order.map(o => o[0]), ['bad', 'fast', 'slow']);
  assert.equal(order[0][1], null);
});

test('nothing more is started or reported once cancelled', async () => {
  let started = 0, reported = 0, stop = false;
  const measure = async () => { started++; await new Promise(r => setTimeout(r, 5)); return { seconds: 1 }; };
  const done = measureEach(Array.from({ length: 20 }, (_, i) => `f${i}`), measure, () => { reported++; }, { cancelled: () => stop });
  stop = true;
  await done;
  assert.equal(started, 6);
  assert.equal(reported, 0);
});

test('a remembered length is merged into what another tab stored', () => {
  store[LENGTHS_KEY] = JSON.stringify({ a: { seconds: 1, file: 'a.mp4' } });
  rememberLength('b', { seconds: 2, file: 'b.mp4' });
  assert.deepEqual(readLengths(), { a: { seconds: 1, file: 'a.mp4' }, b: { seconds: 2, file: 'b.mp4' } });
});

test('an old failure marker is not a length, so the film is measured again', () => {
  store[LENGTHS_KEY] = JSON.stringify({ gone: { seconds: 0 }, none: { seconds: 0, file: null, title: 'None' } });
  assert.deepEqual(Object.keys(readLengths()), ['none']);
});
