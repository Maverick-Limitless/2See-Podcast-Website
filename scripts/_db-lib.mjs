/**
 * Shared helpers for the database scripts. Scripts run as plain Node, so they
 * read the schema from the TypeScript source (the application owns it) rather
 * than importing the app's compiled modules.
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync, renameSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DATABASE_PATH = resolve(process.env.DATABASE_PATH || './data/2see.db');
export const BACKUP_DIR = resolve(process.env.DATABASE_BACKUP_DIR || './data/backups');

export function schemaSource() {
  const file = resolve(dirname(new URL(import.meta.url).pathname), '../src/lib/server/db/schema.ts');
  const source = readFileSync(file, 'utf8');
  const match = /export const SCHEMA_SQL = `([\s\S]*)`;/.exec(source);
  if (!match) throw new Error('Could not read SCHEMA_SQL from schema.ts.');
  return match[1].replace(/\\`/g, '`').replace(/\\\$\{/g, '${');
}

export { existsSync, mkdirSync, copyFileSync, renameSync, statSync, DatabaseSync, resolve, join, dirname };

export function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
