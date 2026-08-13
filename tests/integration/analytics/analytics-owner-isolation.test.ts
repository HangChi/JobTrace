import { expect, test } from "@playwright/test";
test("analytics queries are owner scoped", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      "src/modules/analytics/infrastructure/postgres-analytics.ts",
      "utf8",
    ),
  );
  expect(
    source.match(/owner_id=\$\{ownerId\}/g)?.length,
  ).toBeGreaterThanOrEqual(2);
});
