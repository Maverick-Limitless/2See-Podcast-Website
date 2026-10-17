#!/usr/bin/env node
/** Applies outstanding schema migrations. Safe to run on every deploy. */
import { schemaSource, DATABASE_PATH, mkdirSync, dirname, DatabaseSync } from './_db-lib.mjs';

mkdirSync(dirname(DATABASE_PATH), { recursive: true });
const db = new DatabaseSync(DATABASE_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY, name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')))`);
db.exec(schemaSource());
// journal_mode cannot change inside a transaction, so it is applied after.
db.exec('PRAGMA journal_mode = WAL');
const applied = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get();
console.log(`Schema applied. ${applied.n} migration(s) recorded.`);
db.close();
