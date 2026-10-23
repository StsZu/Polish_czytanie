import { defineConfig, devices } from '@playwright/test'

const ipad = devices['iPad Pro 11']

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { locale: 'uk-UA', trace: 'retain-on-failure' },
  projects: [
    { name: 'ipad-portrait', testIgnore: /(offline|record)\.spec/, use: { ...ipad, browserName: 'webkit', baseURL: 'http://localhost:4280/', acceptDownloads: true } },
    { name: 'ipad-landscape', testIgnore: /(offline|record)\.spec/, use: { ...ipad, browserName: 'webkit', viewport: { width: 1194, height: 834 }, baseURL: 'http://localhost:4280/', acceptDownloads: true } },
    // Service workers in Playwright work in Chromium; the GitHub Pages build under /<repo>/.
    // A fake microphone (a steady tone) exists only in Chromium: the whole «Запис» flow.
    {
      name: 'chromium-mic',
      testMatch: /record\.spec/,
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:4280/',
        permissions: ['microphone'],
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
      },
    },
    { name: 'pages-offline', testMatch: /offline\.spec/, use: { browserName: 'chromium', serviceWorkers: 'allow', baseURL: 'http://localhost:4281/Polish_czytanie/', acceptDownloads: true } },
  ],
  webServer: [
    { command: 'sh scripts/serve-e2e.sh', url: 'http://localhost:4280/', reuseExistingServer: false, timeout: 180_000 },
    // Started by serve-e2e.sh together with the first one; here Playwright only waits for it.
    { command: 'node -e "setInterval(() => {}, 1e9)"', url: 'http://localhost:4281/Polish_czytanie/', reuseExistingServer: true, timeout: 180_000 },
  ],
})
