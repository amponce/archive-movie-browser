import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';

test('the test database speaks the D1 shape and has the schema', async () => {
  const db = await openTestDb();
  await db.prepare('INSERT INTO profiles (id, key_hash, created, updated) VALUES (?, ?, ?, ?)').bind('aaaaaaaaaa', 'h', 1, 1).run();
  assert.equal((await db.prepare('SELECT id FROM profiles WHERE id = ?').bind('aaaaaaaaaa').first()).id, 'aaaaaaaaaa');
  const { results } = await db.prepare('SELECT id FROM profiles').all();
  assert.equal(results.length, 1);
});

test('batch is all or nothing', async () => {
  const db = await openTestDb();
  await assert.rejects(db.batch([
    db.prepare('INSERT INTO profiles (id, key_hash, created, updated) VALUES (?, ?, ?, ?)').bind('bbbbbbbbbb', 'h', 1, 1),
    db.prepare('INSERT INTO nope VALUES (1)'),
  ]));
  assert.equal(await db.prepare('SELECT id FROM profiles').first(), null);
});

test('batch with INSERT and SELECT returns D1 shape with plain objects', async () => {
  const db = await openTestDb();
  const result = await db.batch([
    db.prepare('INSERT INTO profiles (id, key_hash, created, updated) VALUES (?, ?, ?, ?)').bind('cccccccccc', 'h', 1, 1),
    db.prepare('SELECT id FROM profiles WHERE id = ?').bind('cccccccccc'),
  ]);
  assert.deepEqual(result[0], { results: [], meta: { changes: 1 } });
  assert.deepEqual(result[1], { results: [{ id: 'cccccccccc' }], meta: { changes: 0 } });
  assert.deepEqual(await db.prepare('SELECT id FROM profiles').first(), { id: 'cccccccccc' });
});
