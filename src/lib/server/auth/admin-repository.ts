import { randomBytes } from 'node:crypto';
import { getDb } from '../db';
import {
  DEFAULT_PARAMS,
  burnHashCost,
  hashPassword,
  randomSalt,
  serializeParams,
  verifyPassword
} from './password';

/**
 * The administrative account repository.
 *
 * Exactly one administrator exists. The database schema enforces it with a
 * UNIQUE index on a constant `singleton` column, so there is no code path that
 * can create a second account, and every write here is a no-op once a row
 * exists.
 */

export const CANONICAL_USERNAME = 'tosi-podcast';

export interface AdminRecord {
  id: number;
  username: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  hashParams: string;
}

export function adminExists(): boolean {
  const db = getDb();
  const row = db.prepare('SELECT id FROM admins WHERE id = 1').get() as unknown as { id: number } | undefined;
  return Boolean(row);
}

export function getAdminRecord(): AdminRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, username, display_name, password_hash AS passwordHash,
              password_salt AS passwordSalt, hash_params AS hashParams
         FROM admins WHERE id = 1`
    )
    .get() as unknown as AdminRecord | undefined;
  return row ?? null;
}

export function getAdminUsername(): string | null {
  return getAdminRecord()?.username ?? null;
}

/**
 * Creates the one administrator. Throws if one already exists — this is the
 * authoritative guard, and it is enforced by the UNIQUE index on `singleton`
 * as well as this check, so a race between two concurrent boots cannot create
 * two accounts.
 */
export function createAdmin(username: string, displayName: string, password: string): { id: number } {
  if (username !== CANONICAL_USERNAME) {
    throw new Error(`Username must be "${CANONICAL_USERNAME}".`);
  }
  if (adminExists()) {
    throw new Error('An administrator already exists. Initialisation cannot be repeated.');
  }

  const db = getDb();
  const salt = randomSalt();
  const hash = hashPassword(password, salt);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

  db.prepare(
    `INSERT INTO admins (id, username, display_name, password_hash, password_salt,
                         hash_params, password_changed_at)
     VALUES (1, ?, ?, ?, ?, ?, ?)`
  ).run(username, displayName, hash, salt, serializeParams(DEFAULT_PARAMS), now);

  return { id: 1 };
}

export function updateAdminPassword(currentPassword: string, nextPassword: string): boolean {
  const admin = getAdminRecord();
  if (!admin) return false;

  const valid = verifyPassword(currentPassword, {
    hash: admin.passwordHash,
    salt: admin.passwordSalt,
    params: admin.hashParams
  });
  if (!valid) return false;

  const salt = randomSalt();
  const hash = hashPassword(nextPassword, salt);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
  getDb()
    .prepare(
      `UPDATE admins
          SET password_hash = ?, password_salt = ?, hash_params = ?,
              password_changed_at = ?, updated_at = ?
        WHERE id = 1`
    )
    .run(hash, salt, serializeParams(DEFAULT_PARAMS), now, now);
  return true;
}

export function touchLogin(): void {
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
  getDb().prepare('UPDATE admins SET last_login_at = ? WHERE id = 1').run(now);
}

/**
 * Verifies a presented credential in constant work regardless of whether the
 * account exists, so response timing cannot be used to enumerate accounts.
 */
export function verifyAdminCredential(
  username: string,
  password: string
): { ok: true; id: number; needsRehash: boolean } | { ok: false } {
  const admin = getAdminRecord();
  const expectedUsername = admin?.username ?? CANONICAL_USERNAME;

  if (username !== expectedUsername || !admin) {
    // Burn the same scrypt cost as a real verification.
    burnHashCost(password);
    return { ok: false };
  }

  const valid = verifyPassword(password, {
    hash: admin.passwordHash,
    salt: admin.passwordSalt,
    params: admin.hashParams
  });
  if (!valid) return { ok: false };

  // Upgrade the stored parameters if they came from an older, weaker policy.
  const needsRehash = admin.hashParams !== serializeParams(DEFAULT_PARAMS);
  return { ok: true, id: admin.id, needsRehash };
}

/** Fails unless the setup run has not already been consumed. */
export function claimSetupRun(): boolean {
  const db = getDb();
  if (db.prepare('SELECT id FROM setup_runs WHERE id = 1').get()) return false;
  db.prepare('INSERT INTO setup_runs (id) VALUES (1)').run();
  return true;
}

export function newRecoveryToken(): string {
  return randomBytes(24).toString('base64url');
}
