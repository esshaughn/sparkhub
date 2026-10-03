// End-to-end tests. They serve the site from the repo root on localhost, which
// makes js/config.js pick the TEST Supabase project, never live.
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

// Local secrets (git-ignored): E2E_LEAD_PASSWORD for the test project's lead accounts
try {
  for (const line of require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch (e) { /* no .env: CI passes it as a secret */ }

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // CI runs 2 tests at a time: each worker signs in as its own pair of leads (leadEmail() in helpers.js,
  // accounts from scripts/test-leads.py), so nothing collides. Locally one at a time (PW_WORKERS to change it).
  // 2 on CI since 2026-10-03 (was 3): three at once pushed the TEST project's small instance into swap (owner)
  workers: process.env.PW_WORKERS ? +process.env.PW_WORKERS : process.env.CI ? 2 : 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // When the TEST project stalls (a small free instance; it has frozen for minutes late in a full run), every
  // test after that fails the same way. Stop the run there, not after retrying each one into the stall.
  maxFailures: process.env.CI ? 8 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}`,
    // A click on a control that no longer exists fails here, not after the 90s test timeout
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // No traces on CI: they record request bodies (the leads' password) and the repo is public
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory ..`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  }
});
