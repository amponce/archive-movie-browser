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
