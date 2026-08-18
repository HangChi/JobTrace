import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/setup/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup/vitest.setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "tests/e2e/**",
      "tests/integration/**",
      "tests/contract/**",
      "tests/performance/**",
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/modules/*/domain/**/*.ts",
        "src/modules/*/application/*schema.ts",
        "src/modules/applications/application/list-query.ts",
        "src/modules/analytics/application/analytics-rules.ts",
        "src/modules/data-transfer/infrastructure/spreadsheet-{reader,writer}.ts",
        "src/shared/{date,pagination,errors,observability}/**/*.ts",
      ],
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
