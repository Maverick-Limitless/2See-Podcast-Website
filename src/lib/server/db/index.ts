import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config';
import { runMigrations } from './migrate';

let instance: DatabaseSync | null = null;

function resolvePath(raw: string): string {
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

/**
 * Opens the SQLite database, creating the parent directory and applying any
 * outstanding migrations.
 *
 * `node:sqlite` is built into Node 22.5+ and needs no native build step, so the
 * project has no compiled dependency to install or certify.
 */
export function openDatabase(databasePath: string = config.databasePath): DatabaseSync {
  const target = resolvePath(databasePath);
  mkdirSync(dirname(target), { recursive: true });

  const db = new DatabaseSync(target);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  runMigrations(db);
  // journal_mode cannot be changed inside a transaction, so it is applied
  // after migrations have committed.
  db.exec('PRAGMA journal_mode = WAL');
  return db;
}

/** Lazily opens a singleton connection for this deployment. */
export function getDb(): DatabaseSync {
  if (instance) return instance;
  instance = openDatabase();
  return instance;
}

export function setDb(db: DatabaseSync): void {
  instance = db;
}

/** Used by scripts and tests that must not share the singleton. */
export function openFreshDatabase(databasePath: string): DatabaseSync {
  return openDatabase(databasePath);
}

/**
 * `node:sqlite` types rows as `Record<string, SQLOutputValue>`, which does not
 * describe the concrete column shape. Every repository casts its rows through
 * this helper so the assertion is made in one place rather than at each query.
 */
export function row<T>(value: unknown): T {
  return value as T;
}
