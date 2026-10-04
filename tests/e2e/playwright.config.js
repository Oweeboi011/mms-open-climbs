import { defineConfig, devices } from "@playwright/test";

// Smoke tests against the real app on the Firebase emulators. Run with
// `npm run test:e2e`, which starts the emulators around this config.
const PORT = 5174;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  globalSetup: "./seed.js",
  // One worker: parallel cold loads on the Vite dev server trip its
  // dependency optimiser into reloading pages mid-test.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: "../..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_USE_FIREBASE_EMULATOR: "true",
      VITE_FIREBASE_API_KEY: "demo-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-e2e.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "demo-e2e",
      VITE_FIREBASE_STORAGE_BUCKET: "demo-e2e.appspot.com",
      VITE_FIREBASE_APP_ID: "demo-app",
      VITE_APPCHECK_SITE_KEY: "",
    },
  },
});
