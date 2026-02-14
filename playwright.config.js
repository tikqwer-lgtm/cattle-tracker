// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const useElectron = process.env.E2E_ELECTRON === '1' || process.env.E2E_ELECTRON === 'true';

module.exports = defineConfig({
  testDir: './e2e',
  testIgnore: useElectron ? [] : ['**/smoke-electron.spec.js'],
  globalTeardown: useElectron ? path.join(__dirname, 'e2e', 'teardown-electron.js') : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Electron: одно окно на все тесты — только 1 воркер
  workers: useElectron ? 1 : (process.env.CI ? 1 : undefined),
  reporter: 'html',
  use: {
    baseURL: useElectron ? undefined : 'http://localhost:9323',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ru-RU',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(useElectron
      ? [
          {
            name: 'electron',
            testMatch: /smoke-electron\.spec\.js/,
            use: { ...devices['Desktop Chrome'] },
          },
        ]
      : []),
  ],
  webServer: useElectron
    ? {
        command: 'node e2e/start-electron.js',
        url: 'http://localhost:9222/json/version',
        reuseExistingServer: false,
        timeout: 60000,
      }
    : {
        command: 'npx serve -p 9323 .',
        url: 'http://localhost:9323',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
