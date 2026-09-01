import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("job-market scheduler workflow", () => {
  it("keeps the six-hour cadence and drains up to 200 due sources", async () => {
    const workflow = await readFile(
      path.join(process.cwd(), ".github/workflows/job-market-sync.yml"),
      "utf8",
    );

    expect(workflow).toContain('cron: "17 */6 * * *"');
    expect(workflow).toContain("max_batches=20");
    expect(workflow).toContain("claimed < batch_size");
  });
});
