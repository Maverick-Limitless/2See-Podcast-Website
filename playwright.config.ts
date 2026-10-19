import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }
  ],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        // The setup script recreates a deterministic test database from the
        // committed fixture, then the production build boots against it.
        command: 'node scripts/e2e-setup.mjs && node build/index.js',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
        timeout: 60000,
        env: {
          PORT: '4173',
          DATABASE_PATH: process.env.E2E_DATABASE_PATH || './data/e2e.db',
          NODE_ENV: 'test',
          ORIGIN: 'http://127.0.0.1:4173',
          PUBLIC_ORIGIN: 'http://127.0.0.1:4173',
          // Deterministic test-only values, the same convention as
          // tests/setup.ts. Production still refuses to boot without real
          // secrets (see src/lib/server/config.ts).
          SESSION_SECRET: 'test-only-session-secret-not-a-real-credential',
          CSRF_SECRET: 'test-only-csrf-secret-not-a-real-credential',
          // Test-environment setting. The suite deliberately submits wrong
          // passwords more than once, so the production throttle would make the
          // order of the tests significant.
          LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '200'
        }
      }
});
