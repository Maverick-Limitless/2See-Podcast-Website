import { config } from '../config';
import { getDb } from '../db';

/**
 * Login throttling.
 *
 * Attempts are recorded in the database rather than memory so the limit holds
 * across process restarts and works with more than one deployment instance
 * against the same database. The counter is keyed on client address.
 */

function isoNow(offsetSeconds = 0): string {
  return new Date(Date.now() + offsetSeconds * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace('Z', '');
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkLoginRateLimit(ipAddress: string): RateLimitVerdict {
  if (ipAddress === '' || ipAddress === 'unknown') {
    // Without an address we cannot throttle reliably; the generic error message
    // still applies, and the account has a strong password.
    return { allowed: true, remaining: config.loginRateLimitMaxAttempts, retryAfterSeconds: 0 };
  }
  const db = getDb();
  const windowStart = isoNow(-config.loginRateLimitWindowSeconds);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS attempts FROM login_attempts
        WHERE ip_address = ? AND attempted_at > ?`
    )
    .get(ipAddress, windowStart) as { attempts: number } | undefined;
  const attempts = row?.attempts ?? 0;

  if (attempts >= config.loginRateLimitMaxAttempts) {
    const oldest = db
      .prepare(
        `SELECT MIN(attempted_at) AS first_at FROM login_attempts
          WHERE ip_address = ? AND attempted_at > ?`
      )
      .get(ipAddress, windowStart) as { first_at: string | null } | undefined;
    const retryAfter = oldest?.first_at
      ? Math.max(
          1,
          Math.ceil(
            (new Date(oldest.first_at.replace(' ', 'T') + 'Z').getTime() +
              config.loginRateLimitWindowSeconds * 1000 -
              Date.now()) /
              1000
          )
        )
      : config.loginRateLimitWindowSeconds;
    return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter };
  }
  return {
    allowed: true,
    remaining: config.loginRateLimitMaxAttempts - attempts,
    retryAfterSeconds: 0
  };
}

export function recordLoginAttempt(
  ipAddress: string,
  username: string,
  succeeded: boolean
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO login_attempts (ip_address, username, succeeded) VALUES (?, ?, ?)`
  ).run(ipAddress === '' ? null : ipAddress, username, succeeded ? 1 : 0);
}

export function resetLoginAttempts(ipAddress: string): void {
  if (ipAddress === '' || ipAddress === 'unknown') return;
  const db = getDb();
  db.prepare(`DELETE FROM login_attempts WHERE ip_address = ? AND attempted_at < ?`).run(
    ipAddress,
    isoNow()
  );
}

/** Housekeeping for the attempt log. */
export function pruneLoginAttempts(): number {
  const db = getDb();
  const cutoff = isoNow(-config.loginRateLimitWindowSeconds * 4);
  const result = db.prepare(`DELETE FROM login_attempts WHERE attempted_at < ?`).run(cutoff);
  return Number(result.changes);
}
