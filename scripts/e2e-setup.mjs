#!/usr/bin/env node
/**
 * Rebuilds the deterministic browser-test database from a committed fixture.
 *
 * The fixture holds the channel's real, published episode metadata — the same
 * records the live-feed synchroniser imports — so `npm run test:e2e` runs
 * identically on every machine, offline, with no state drifting between runs.
 * Stories start empty: the admin suite creates and removes its own. The
 * database is deleted and recreated from scratch on every run.
 *
 * playwright.config.ts runs this automatically before the server boots. The
 * administrator password matches the fallback in tests/browser/admin.spec.ts
 * and is a test value only — never a production credential.
 *
 * Override with E2E_DATABASE_PATH (or DATABASE_PATH) and E2E_ADMIN_PASSWORD.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { schemaSource } from './_db-lib.mjs';

const HERE = dirname(new URL(import.meta.url).pathname);
const DATABASE_PATH = resolve(
  process.env.E2E_DATABASE_PATH || process.env.DATABASE_PATH || './data/e2e.db'
);
const FIXTURE = resolve(HERE, '../tests/fixtures/e2e-episodes.json');
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'local-e2e-password-placeholder';

const COLUMNS = [
  'youtube_id', 'slug', 'title', 'original_title', 'summary', 'description',
  'guests', 'host_names', 'series', 'episode_number', 'category', 'tags',
  'thumbnail_url', 'duration_seconds', 'published_at', 'state', 'language',
  'format', 'featured', 'meta_title', 'meta_description', 'sync_source',
  'synced_at', 'manually_edited'
];

function main() {
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(DATABASE_PATH + suffix, { force: true });
  }
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });

  const db = new DatabaseSync(DATABASE_PATH);
  db.exec(schemaSource());
  const episodes = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const insert = db.prepare(
    `INSERT INTO episodes (${COLUMNS.join(', ')})
     VALUES (${COLUMNS.map(() => '?').join(', ')})`
  );
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const episode of episodes) {
      insert.run(...COLUMNS.map((column) => episode[column] ?? null));
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  db.close();

  // The administrator is created by the same script production uses, so
  // hashing and session-revocation semantics can never drift from the real flow.
  const spawned = spawnSync(process.execPath, [resolve(HERE, 'init-admin.mjs'), '--force'], {
    env: { ...process.env, DATABASE_PATH, ADMIN_SETUP_PASSWORD: PASSWORD },
    stdio: 'inherit'
  });
  if (spawned.status !== 0) process.exit(spawned.status ?? 1);

  console.log(`e2e database ready (${episodes.length} episodes): ${DATABASE_PATH}`);
}

main();
