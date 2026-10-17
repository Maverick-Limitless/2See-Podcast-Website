import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getDb, openFreshDatabase, setDb } from './db';
import { reloadConfig } from './config';

/**
 * Test-only helpers.
 *
 * These exist so the automated suite can run against an isolated database
 * without touching ./data and without any production credential. Nothing in
 * the application imports this module.
 */

let assigned: DatabaseSync | null = null;
const tempDirs: string[] = [];

/**
 * Points the application at a fresh temporary database and re-reads
 * configuration from the current environment.
 */
export function resetConfigForTests(): void {
  const config = reloadConfig();
  // Session and CSRT config for tests comes from tests/setup.ts, which sets
  // process.env before this module is first imported.
  void config;
}

/** Creates a brand-new isolated database and returns it. */
export function createTestDatabase(): DatabaseSync {
  const dir = mkdtempSync(join(tmpdir(), '2see-test-'));
  tempDirs.push(dir);
  const db = openFreshDatabase(join(dir, 'test.db'));
  setDb(db);
  assigned = db;
  return db;
}

/** The database currently installed by createTestDatabase. */
export function currentTestDatabase(): DatabaseSync {
  if (assigned) return assigned;
  return getDb();
}

/** Removes every temporary database created during a test run. */
export function cleanupTestDatabases(): void {
  for (const dir of tempDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // A locked file on Windows is not a test failure.
    }
  }
  assigned = null;
}
