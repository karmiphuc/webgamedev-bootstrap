import { defineConfig, devices } from "@playwright/test";
import config from "./game.config.json" with { type: "json" };

// Browser tests run against the BUILT artifact (npm run build), served under
// /<slug>/ like GitHub Pages. Set PLAYWRIGHT_CHROMIUM_PATH to use an
// already-installed Chromium instead of `npx playwright install chromium`.
const PORT = 4173;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const DESKTOP_ONLY = /pixels\.spec\.ts/;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0, // a flaky browser test is a bug to fix, not to retry
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  snapshotPathTemplate: "tests/e2e/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/${config.slug}/`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath,
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    // Pixel goldens and the offline check run once, on desktop.
    { name: "tablet", testIgnore: DESKTOP_ONLY, use: { ...devices["iPad (gen 7) landscape"], browserName: "chromium" } },
    { name: "phone", testIgnore: DESKTOP_ONLY, use: { ...devices["Pixel 7"], browserName: "chromium" } },
  ],
  webServer: {
    command: `node tools/serve.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/${config.slug}/`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
