import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

/**
 * Version 1 creates the full schema. Future migrations are appended as objects
 * here and automatically recorded, so upgrading never destroys data.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [SCHEMA_SQL]
  }
];

export interface MigrationResult {
  applied: number[];
  alreadyAt: number;
}

/**
 * Applies every migration newer than the recorded version, inside a transaction
 * per migration. Safe to call on every boot: re-running is a no-op.
 */
export function runMigrations(db: DatabaseSync): MigrationResult {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  const row = db
    .prepare('SELECT MAX(version) AS version FROM schema_migrations')
    .get() as { version: number | null } | undefined;
  const current = row?.version ?? 0;

  const applied: number[] = [];
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const statement of migration.statements) db.exec(statement);
      db
        .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name);
      db.exec('COMMIT');
      applied.push(migration.version);
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${(error as Error).message}`
      );
    }
  }
  return { applied, alreadyAt: current };
}
