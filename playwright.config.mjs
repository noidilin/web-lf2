import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: /smoke\.test\.[jt]s$/,
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8765',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'tests/results',
  webServer: [
    {
      command: 'node scripts/serve-static.mjs',
      port: 8765,
      reuseExistingServer: true,
      timeout: 10_000,
    },
    {
      command: 'docker compose up lobby',
      port: 8001,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
