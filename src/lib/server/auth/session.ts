import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { config } from '../config';
import { getDb } from '../db';

export const SESSION_COOKIE = '2see_session';
export const CSRF_COOKIE = '2see_csrf';

/**
 * Sessions are server-side records keyed by a hash of a 256-bit random token.
 * The token itself only ever lives in the httpOnly cookie, so even a full
 * database disclosure does not yield a usable session.
 */

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Signed CSRF token = random value + HMAC. The value is not itself a secret. */
export function signCsrf(value: string): string {
  if (config.csrfSecret === '') throw new Error('CSRF secret is not configured.');
  const mac = createHmac('sha256', config.csrfSecret).update(value).digest('base64url');
  return `${value}.${mac}`;
}

export function verifyCsrf(signed: string): boolean {
  if (config.csrfSecret === '') return false;
  const parts = signed.split('.');
  if (parts.length !== 2) return false;
  const [value, mac] = parts as [string, string];
  const expected = createHmac('sha256', config.csrfSecret).update(value).digest('base64url');
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

function isoNow(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '');
}

export interface SessionContext {
  ipAddress: string;
  userAgent: string;
}

export async function createSession(
  adminId: number,
  context: SessionContext
): Promise<{ token: string; expiresAt: string }> {
  const db = getDb();
  const token = newSessionToken();
  const expiresAt = isoNow(config.sessionTtlSeconds);
  db.prepare(
    `INSERT INTO sessions (token_hash, expires_at, ip_address, user_agent, admin_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(hashToken(token), expiresAt, context.ipAddress, context.userAgent, adminId);
  return { token, expiresAt };
}

export interface ActiveAdmin {
  id: number;
  username: string;
  displayName: string;
}

/** Returns the authenticated administrator for a presented token, or null. */
export function resolveSession(token: string | undefined): ActiveAdmin | null {
  if (!token || token === '') return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at AS expires_at, s.revoked_at AS revoked_at,
              a.id AS id, a.username AS username, a.display_name AS display_name
         FROM sessions s JOIN admins a ON a.id = s.admin_id
        WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as
    | { session_id: number; expires_at: string; revoked_at: string | null; id: number; username: string; displayName: string }
    | undefined;

  if (!row) return null;
  if (row.revoked_at) return null;
  // Expiry is enforced in SQL normalised time; verify in JS too so a clock
  // change on the database side cannot resurrect a dead session.
  if (new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()) return null;

  return { id: row.id, username: row.username, displayName: row.displayName };
}

/** Deletes every session for this administrator (used on password change). */
export function revokeAllSessions(adminId: number): number {
  const db = getDb();
  const result = db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL`)
    .run(isoNow(), adminId);
  return Number(result.changes);
}

/** Revokes only the presented token. Returns true when a row was affected. */
export function revokeSession(token: string | undefined): boolean {
  if (!token || token === '') return false;
  const db = getDb();
  const result = db
    .prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`)
    .run(isoNow(), hashToken(token));
  return Number(result.changes) > 0;
}

/** Housekeeping: drop sessions that expired more than a day ago. */
export function pruneExpiredSessions(): number {
  const db = getDb();
  const cutoff = isoNow(-86400);
  const result = db
    .prepare(`DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)`)
    .run(cutoff, cutoff);
  return Number(result.changes);
}

/**
 * Rotates the presented session into a brand-new token. The old token is
 * revoked, so a token captured before login cannot be reused afterwards.
 */
export async function rotateSession(
  oldToken: string | undefined,
  adminId: number,
  context: SessionContext
): Promise<{ token: string; expiresAt: string }> {
  revokeSession(oldToken);
  return createSession(adminId, context);
}

export function cookieAttributes(): string {
  const parts = [
    'Path=/',
    'HttpOnly',
    `SameSite=${config.isProduction ? 'Strict' : 'Lax'}`
  ];
  if (config.isProduction) parts.push('Secure');
  return parts.join('; ');
}
