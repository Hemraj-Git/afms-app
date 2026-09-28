import { defineConfig, devices } from '@playwright/test'

// End-to-end tests (e2e/). They run against the dev Supabase project in
// .env.local, with their own "[E2E]" accounts and records that are created
// before the run and deleted after it (e2e/support/backend.ts).
//
//   npm run e2e            headless, list output (starts `npm run dev` if needed)
//   npm run e2e:ui         Playwright's UI mode, to watch or debug a test
//   npm run e2e:cleanup    delete leftovers if a run was interrupted

export default defineConfig({
  testDir: 'e2e',
  // One shared database: run the flows one after another.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /global\.teardown\.ts/ },
    {
      name: 'e2e',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
})
