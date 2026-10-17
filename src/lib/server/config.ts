import { env } from 'node:process';

/**
 * Runtime configuration for a single-server deployment.
 *
 * Everything is read from the process environment exactly once, so a missing
 * value fails loudly at boot instead of behaving unpredictably at request time.
 * No secret is ever returned to the browser: this module is imported only from
 * server-side code.
 */

export interface AppConfig {
  readonly nodeEnv: 'production' | 'development' | 'test';
  readonly isProduction: boolean;
  readonly port: number;
  readonly host: string;
  readonly publicOrigin: string;
  readonly databasePath: string;
  readonly databaseBackupDir: string;
  readonly sessionSecret: string;
  readonly csrfSecret: string;
  readonly sessionTtlSeconds: number;
  readonly adminSetupPassword: string;
  readonly adminDisplayName: string;
  readonly adminSetupToken: string;
  readonly youtubeApiKey: string;
  readonly youtubeChannelHandle: string;
  readonly youtubeChannelId: string;
  readonly youtubeSyncMaxResults: number;
  readonly loginRateLimitWindowSeconds: number;
  readonly loginRateLimitMaxAttempts: number;
  readonly maxRequestSizeBytes: number;
}

function str(key: string, fallback = ''): string {
  const value = env[key];
  return value === undefined || value === '' ? fallback : value.trim();
}

function num(key: string, fallback: number): number {
  const raw = str(key);
  if (raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback = false): boolean {
  const raw = str(key).toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return fallback;
}

export function readConfig(): AppConfig {
  const nodeEnvRaw = str('NODE_ENV', 'development');
  const nodeEnv =
    nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development';
  const sessionSecret = str('SESSION_SECRET');

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: num('PORT', 3000),
    host: str('HOST', '127.0.0.1'),
    publicOrigin: str('PUBLIC_ORIGIN', '').replace(/\/+$/, ''),
    databasePath: str('DATABASE_PATH', './data/2see.db'),
    databaseBackupDir: str('DATABASE_BACKUP_DIR', './data/backups'),
    sessionSecret,
    // CSRF tokens are derived from the session secret plus a purpose label when
    // no dedicated secret is supplied, so a single-secret deployment still works.
    csrfSecret: str('CSRF_SECRET') || (sessionSecret ? `${sessionSecret}::csrf` : ''),
    sessionTtlSeconds: num('SESSION_TTL_SECONDS', 43200),
    adminSetupPassword: str('ADMIN_SETUP_PASSWORD'),
    adminDisplayName: str('ADMIN_DISPLAY_NAME', 'Tosi Podcast'),
    adminSetupToken: str('ADMIN_SETUP_TOKEN'),
    youtubeApiKey: str('YOUTUBE_API_KEY'),
    youtubeChannelHandle: str('YOUTUBE_CHANNEL_HANDLE', '@2See.Podcast'),
    youtubeChannelId: str('YOUTUBE_CHANNEL_ID'),
    youtubeSyncMaxResults: num('YOUTUBE_SYNC_MAX_RESULTS', 25),
    loginRateLimitWindowSeconds: num('LOGIN_RATE_LIMIT_WINDOW_SECONDS', 900),
    loginRateLimitMaxAttempts: num('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 8),
    maxRequestSizeBytes: num('MAX_REQUEST_SIZE_BYTES', 262144)
  };
}

function requireSecret(config: AppConfig): AppConfig {
  if (config.sessionSecret !== '') return config;
  if (config.isProduction) {
    throw new Error('SESSION_SECRET is required. Generate one with: openssl rand -base64 48');
  }
  // Development fallback keeps `npm run dev` usable on a clean checkout.
  return { ...config, sessionSecret: 'development-only-insecure-session-secret' };
}

export const config: AppConfig = requireSecret(readConfig());

/** Re-reads configuration from the environment. Used by scripts and tests. */
export function reloadConfig(): AppConfig {
  return readConfig();
}

export const envFlag = bool;
