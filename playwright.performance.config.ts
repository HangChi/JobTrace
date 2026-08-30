import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/performance",
  testMatch: ["authentication-performance.ts", "web-vitals.spec.ts"],
  workers: 1,
  globalSetup: "./tests/setup/auth.global.ts",
  use: {
    baseURL: "http://127.0.0.1:3003",
    storageState: ".playwright/auth-performance.json",
  },
  webServer: {
    command: `"${process.execPath}" ./scripts/next-dev.mjs 3003 .next-performance`,
    url: "http://127.0.0.1:3003/api/health",
    reuseExistingServer: false,
  },
});
