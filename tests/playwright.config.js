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
  // Tests share one test database; keep them sequential so counts and lists are predictable.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory ..`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  }
});
