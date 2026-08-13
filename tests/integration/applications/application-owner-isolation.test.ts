import { expect, test } from "@playwright/test";
test("application SQL paths require owner predicates", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      "src/modules/applications/infrastructure/postgres-application-repository.ts",
      "utf8",
    ),
  );
  expect(source).toContain("a.owner_id = ${ownerId}");
  expect(source).toContain("assert_application_owner");
  expect(source).toContain("and owner_id=${ownerId}");
});
