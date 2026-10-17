import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Test setup. Everything here runs before any test file is imported.
 *
 * The suite uses throwaway SQLite databases in a temporary directory. No test
 * reads or writes the development database, and no production credential is
 * ever used: the values below are placeholders.
 */

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-not-a-real-credential';
process.env.CSRF_SECRET = 'test-only-csrf-secret-not-a-real-credential';
process.env.SESSION_TTL_SECONDS = '43200';

/**
 * Creates a brand-new isolated database and installs it as the application
 * singleton, so server modules calling getDb() see the test data.
 */
export async function useTestDatabase(): Promise<DatabaseSync> {
  const dir = mkdtempSync(join(tmpdir(), '2see-test-'));
  const { setDb, openFreshDatabase } = await import('../src/lib/server/db/index');
  const db = openFreshDatabase(join(dir, 'test.db'));
  setDb(db);
  return db;
}

export function freshDatabasePath(): string {
  return join(mkdtempSync(join(tmpdir(), '2see-db-')), 'test.db');
}
