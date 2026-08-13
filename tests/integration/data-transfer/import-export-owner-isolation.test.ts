import { expect, test } from "@playwright/test";
test("import batches, duplicates and exports are owner scoped", async () => {
  const fs = await import("node:fs/promises");
  const repo = await fs.readFile(
      "src/modules/data-transfer/infrastructure/postgres-import-repository.ts",
      "utf8",
    ),
    exp = await fs.readFile(
      "src/modules/data-transfer/application/export-applications.ts",
      "utf8",
    );
  expect(repo).toContain("owner_id=${ownerId}");
  expect(exp).toContain("owner_id=${actor.id}");
});
