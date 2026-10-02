// D1-shaped wrapper over node:sqlite with the real migrations applied, for tests.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const MIGRATIONS = new URL('../../migrations/', import.meta.url);

export async function openTestDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) raw.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  const statement = (sql, args = []) => ({
    sql, args,
    bind: (...next) => statement(sql, next),
    first: async () => raw.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...args).changes) } }),
  });
  return {
    prepare: sql => statement(sql),
    batch: async (statements) => {
      raw.exec('BEGIN');
      try {
        const out = statements.map(s => ({ meta: { changes: Number(raw.prepare(s.sql).run(...s.args).changes) } }));
        raw.exec('COMMIT');
        return out;
      } catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
}
