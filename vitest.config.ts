import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globals: false,
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true }
    }
  }
});
