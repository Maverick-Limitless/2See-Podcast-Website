#!/usr/bin/env node
/**
 * Creates the one administrative account.
 *
 * A cryptographically secure random password is generated and printed once. It
 * is never written to disk, never logged anywhere except this terminal, and
 * never stored in plaintext — only a scrypt hash is kept.
 *
 * Usage:
 *   npm run init:admin
 *   npm run init:admin -- --password-stdin     # read the password from stdin
 *   npm run init:admin -- --force              # replace an existing account
 *
 * If ADMIN_SETUP_PASSWORD is set, that value is used instead of a generated
 * one. Otherwise a fresh random password is generated here.
 */

import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';

const DATABASE_PATH = resolve(process.env.DATABASE_PATH || './data/2see.db');
const USERNAME = 'tosi-podcast';
const DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || 'Tosi Podcast';

/** Loads the schema from the TypeScript module, which owns the single copy. */
function loadSchema() {
  const source = readFileSync(
    resolve(dirname(new URL(import.meta.url).pathname), '../src/lib/server/db/schema.ts'),
    'utf8'
  );
  const match = /export const SCHEMA_SQL = `([\s\S]*)`;/.exec(source);
  if (!match) throw new Error('Could not read SCHEMA_SQL from schema.ts.');
  return match[1]
    .replace(/\\`/g, '`')
    .replace(/\\\$\{/g, '${');
}

/** Cryptographically secure random password, no bias in class composition. */
function generatePassword(length = 24) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const alphabet = upper + lower + digits + symbols;

  // unbiased random index from 32 random bits, rejection-sampled
  const randomIndex = (bound) => {
    const limit = Math.floor(0xffffffff / bound) * bound;
    for (;;) {
      const value = randomBytes(4).readUInt32BE(0);
      if (value < limit) return value % bound;
    }
  };

  const chars = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    symbols[randomIndex(symbols.length)]
  ];
  while (chars.length < length) chars.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function main() {
  const flags = process.argv.slice(2);
  const force = flags.includes('--force');
  const fromStdin = flags.includes('--password-stdin');

  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  const db = new DatabaseSync(DATABASE_PATH);
  db.exec(loadSchema());

  const existing = db.prepare('SELECT id FROM admins WHERE id = 1').get();
  if (existing && !force) {
    console.error('An administrator already exists.');
    console.error('Run with --force to replace it (this revokes every session),');
    console.error('or change the password from Settings inside the panel.');
    db.close();
    process.exit(1);
  }

  let password;
  if (fromStdin) {
    password = readFileSync(0, 'utf8').trim();
  } else if (process.env.ADMIN_SETUP_PASSWORD) {
    password = process.env.ADMIN_SETUP_PASSWORD.trim();
  } else {
    password = generatePassword();
  }

  if (password.length < 12) {
    console.error('The password must be at least 12 characters.');
    db.close();
    process.exit(1);
  }

  const salt = randomBytes(32).toString('hex');
  const hash = scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024
  }).toString('hex');
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

  db.prepare(
    `INSERT INTO admins (id, username, display_name, password_hash, password_salt,
                         hash_params, password_changed_at)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       display_name = excluded.display_name,
       password_hash = excluded.password_hash,
       password_salt = excluded.password_salt,
       hash_params = excluded.hash_params,
       password_changed_at = excluded.password_changed_at,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ).run(USERNAME, DISPLAY_NAME, hash, salt, 'scrypt$32768$8$1$64', now);

  if (existing) {
    db.prepare(
      `UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE revoked_at IS NULL`
    ).run();
  }

  db.close();

  console.log('');
  console.log('Administrator account ' + (existing ? 'replaced' : 'created') + '.');
  console.log('');
  console.log('  Username : ' + USERNAME);
  console.log('  Password : ' + password);
  console.log('');
  console.log('This is the only time the password is displayed. Copy it now and');
  console.log('store it in a password manager. Nothing is written to disk.');
  if (fromStdin || process.env.ADMIN_SETUP_PASSWORD) {
    console.log('(Password supplied by the operator, not generated.)');
  }
  console.log('');
}

main();
