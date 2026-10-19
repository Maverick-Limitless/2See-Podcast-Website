import { afterEach, describe, expect, it } from 'vitest';
import { reloadConfig } from '../../src/lib/server/config';

/**
 * The secret-fallback path a clean checkout takes before .env exists. The
 * module singleton was created from tests/setup.ts's environment; reloadConfig
 * re-reads the process environment, so each case controls it directly.
 */

const KEYS = ['SESSION_SECRET', 'CSRF_SECRET', 'NODE_ENV'] as const;

let saved: Record<string, string | undefined> = {};

function setEnv(overrides: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  setEnv(saved);
  saved = {};
});

describe('configuration secret fallback', () => {
  it('bootstraps both secrets on a clean checkout with no env at all', () => {
    saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
    setEnv({ SESSION_SECRET: undefined, CSRF_SECRET: undefined, NODE_ENV: 'development' });

    const config = reloadConfig();
    expect(config.sessionSecret).toBe('development-only-insecure-session-secret');
    // A server that boots must also be able to sign CSRF tokens: if the
    // fallback does not cover signing, every request fails after startup.
    expect(config.csrfSecret).toBe('development-only-insecure-session-secret::csrf');
  });

  it('derives the CSRF secret for a single-secret deployment', () => {
    saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
    setEnv({ SESSION_SECRET: 'one-real-secret', CSRF_SECRET: undefined, NODE_ENV: 'development' });

    const config = reloadConfig();
    expect(config.sessionSecret).toBe('one-real-secret');
    expect(config.csrfSecret).toBe('one-real-secret::csrf');
  });

  it('keeps a dedicated CSRF secret and falls back only for the session', () => {
    saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
    setEnv({ SESSION_SECRET: undefined, CSRF_SECRET: 'dedicated-csrf', NODE_ENV: 'test' });

    const config = reloadConfig();
    expect(config.csrfSecret).toBe('dedicated-csrf');
    expect(config.sessionSecret).toBe('development-only-insecure-session-secret');
  });

  it('refuses to run in production without a session secret', () => {
    saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
    setEnv({ SESSION_SECRET: undefined, CSRF_SECRET: undefined, NODE_ENV: 'production' });

    expect(() => reloadConfig()).toThrow('SESSION_SECRET is required');
  });
});
