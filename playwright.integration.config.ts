import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/integration",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3002" },
  webServer: {
    command: `"${process.execPath}" ./node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3002`,
    url: "http://127.0.0.1:3002/api/health",
    reuseExistingServer: false,
  },
});
