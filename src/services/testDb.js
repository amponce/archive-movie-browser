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
    first: async () => { const row = raw.prepare(sql).get(...args); return row ? { ...row } : null; },
    all: async () => ({ results: raw.prepare(sql).all(...args).map(r => ({ ...r })) }),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...args).changes) } }),
  });
  return {
    prepare: sql => statement(sql),
    batch: async (statements) => {
      raw.exec('BEGIN');
      try {
        const out = statements.map(s => {
          const stmt = raw.prepare(s.sql);
          const hasColumns = stmt.columns().length > 0;
          if (hasColumns) {
            const results = stmt.all(...s.args).map(r => ({ ...r }));
            return { results, meta: { changes: 0 } };
          } else {
            const changes = Number(stmt.run(...s.args).changes);
            return { results: [], meta: { changes } };
          }
        });
        raw.exec('COMMIT');
        return out;
      } catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
}
