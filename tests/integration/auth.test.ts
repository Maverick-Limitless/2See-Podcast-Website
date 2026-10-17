import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../setup';
import { getDb } from '../../src/lib/server/db';
import { config } from '../../src/lib/server/config';
import {
  adminExists,
  CANONICAL_USERNAME,
  claimSetupRun,
  createAdmin,
  getAdminRecord,
  getAdminUsername,
  updateAdminPassword,
  verifyAdminCredential
} from '../../src/lib/server/auth/admin-repository';
import {
  createSession,
  hashToken,
  resolveSession,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  SESSION_COOKIE
} from '../../src/lib/server/auth/session';
import { checkLoginRateLimit, recordLoginAttempt } from '../../src/lib/server/auth/rate-limit';

const PASSWORD = 'integration-test-password-2026';

beforeEach(async () => {
  await useTestDatabase();
});

describe('single administrator enforcement', () => {
  it('starts with no account and a null username', () => {
    expect(adminExists()).toBe(false);
    expect(getAdminUsername()).toBeNull();
  });

  it('creates the account under the canonical username', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    expect(adminExists()).toBe(true);
    expect(getAdminUsername()).toBe('tosi-podcast');
  });

  it('refuses a second account through the repository', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    expect(() => createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD)).toThrow(
      /already exists/i
    );
    expect(adminExists()).toBe(true);
  });

  it('refuses any username other than the canonical one', () => {
    expect(() => createAdmin('someone-else', 'Tosi', PASSWORD)).toThrow(/tosi-podcast/i);
    expect(adminExists()).toBe(false);
  });

  it('enforces the single-row constraint at the database layer', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    // Even writing straight to SQL cannot create a second administrator, which
    // is the point of the constraint living in the schema.
    expect(() =>
      getDb()
        .prepare(
          `INSERT INTO admins (id, username, display_name, password_hash, password_salt, hash_params)
           VALUES (2, 'tosi-podcast', 'other', 'h', 's', 'scrypt$32768$8$1$64')`
        )
        .run()
    ).toThrow();
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM admins').get()).toEqual({ n: 1 });
  });

  it('consumes the one-time setup run exactly once', () => {
    expect(claimSetupRun()).toBe(true);
    expect(claimSetupRun()).toBe(false);
  });
});

describe('credential verification', () => {
  it('accepts the right password and rejects the wrong one', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    expect(verifyAdminCredential('tosi-podcast', PASSWORD).ok).toBe(true);
    expect(verifyAdminCredential('tosi-podcast', 'wrong-password-value').ok).toBe(false);
  });

  it('treats a wrong username identically to a wrong password', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const wrongUser = verifyAdminCredential('not-a-user', PASSWORD);
    const wrongPass = verifyAdminCredential('tosi-podcast', PASSWORD + 'x');
    expect(wrongUser.ok).toBe(false);
    expect(wrongPass.ok).toBe(false);
  });

  it('rejects credentials when no account exists', () => {
    expect(verifyAdminCredential('tosi-podcast', PASSWORD).ok).toBe(false);
  });

  it('stores no plaintext password and keeps a long unique salt', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const admin = getAdminRecord()!;
    expect(admin.passwordHash).not.toContain(PASSWORD);
    expect(admin.passwordSalt.length).toBeGreaterThanOrEqual(32);
    // Parameters persist alongside, so a future parameter change is detectable.
    expect(admin.hashParams).toMatch(/^scrypt\$/);
  });

  it('changes the password only when the current one is correct', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    expect(updateAdminPassword('wrong', 'a-brand-new-password-2026!')).toBe(false);
    expect(verifyAdminCredential('tosi-podcast', PASSWORD).ok).toBe(true);

    expect(updateAdminPassword(PASSWORD, 'a-brand-new-password-2026!')).toBe(true);
    expect(verifyAdminCredential('tosi-podcast', PASSWORD).ok).toBe(false);
    expect(verifyAdminCredential('tosi-podcast', 'a-brand-new-password-2026!').ok).toBe(true);
  });
});

describe('session management', () => {
  it('resolves a valid token and rejects a forged one', async () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const { token } = await createSession(1, { ipAddress: '10.0.0.1', userAgent: 'test' });
    expect(resolveSession(token)?.username).toBe('tosi-podcast');
    expect(resolveSession('not-a-real-token')).toBeNull();
    expect(resolveSession(undefined)).toBeNull();
  });

  it('stores only a hash of the token, never the token', async () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const { token } = await createSession(1, { ipAddress: '10.0.0.1', userAgent: 'test' });
    const row = getDb().prepare('SELECT token_hash FROM sessions').get() as {
      token_hash: string;
    };
    expect(row.token_hash).toBe(hashToken(token));
    expect(row.token_hash).not.toContain(token);
  });

  it('revokes a single token on logout', async () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const { token } = await createSession(1, { ipAddress: '10.0.0.1', userAgent: 'test' });
    expect(revokeSession(token)).toBe(true);
    expect(resolveSession(token)).toBeNull();
    // Revoking again is a harmless no-op, not an error.
    expect(revokeSession(token)).toBe(false);
  });

  it('rotates a session so a pre-login token cannot be reused', async () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const context = { ipAddress: '10.0.0.1', userAgent: 'test' };
    const { token: oldToken } = await createSession(1, context);
    const { token: newToken } = await rotateSession(oldToken, 1, context);
    expect(newToken).not.toBe(oldToken);
    expect(resolveSession(oldToken)).toBeNull();
    expect(resolveSession(newToken)?.username).toBe('tosi-podcast');
  });

  it('revoking every session signs out all devices', async () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const tokens: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const { token } = await createSession(1, {
        ipAddress: '10.0.0.1',
        userAgent: 'test'
      });
      tokens.push(token);
    }
    expect(revokeAllSessions(1)).toBeGreaterThanOrEqual(3);
    for (const token of tokens) expect(resolveSession(token)).toBeNull();
  });

  it('uses an httpOnly cookie name', () => {
    expect(SESSION_COOKIE).toBe('2see_session');
  });
});

describe('login throttling', () => {
  it('allows attempts up to the configured limit, then blocks', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    const limit = config.loginRateLimitMaxAttempts;
    for (let i = 0; i < limit; i += 1) {
      expect(checkLoginRateLimit('203.0.113.9').allowed).toBe(true);
      recordLoginAttempt('203.0.113.9', 'tosi-podcast', false);
    }
    const verdict = checkLoginRateLimit('203.0.113.9');
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('does not throttle one client because of another', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    for (let i = 0; i < 20; i += 1) recordLoginAttempt('203.0.113.9', 'tosi-podcast', false);
    expect(checkLoginRateLimit('198.51.100.4').allowed).toBe(true);
  });

  it('does not lift a throttle just because a later attempt succeeded', () => {
    createAdmin(CANONICAL_USERNAME, 'Tosi Podcast', PASSWORD);
    for (let i = 0; i < 8; i += 1) recordLoginAttempt('203.0.113.9', 'tosi-podcast', false);
    recordLoginAttempt('203.0.113.9', 'tosi-podcast', true);
    expect(checkLoginRateLimit('203.0.113.9').allowed).toBe(false);
  });
});
