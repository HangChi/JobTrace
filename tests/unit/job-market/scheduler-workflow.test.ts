import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("job-market scheduler workflow", () => {
  it("uses the server timer for the six-hour cadence and keeps GitHub as a manual fallback", async () => {
    const [timer, syncScript, workflow] = await Promise.all([
      readFile(
        path.join(process.cwd(), "deploy/server/jobtrace-sync.timer"),
        "utf8",
      ),
      readFile(
        path.join(process.cwd(), "deploy/server/jobtrace-sync.sh"),
        "utf8",
      ),
      readFile(
        path.join(process.cwd(), ".github/workflows/job-market-sync.yml"),
        "utf8",
      ),
    ]);

    expect(timer.match(/^OnCalendar=/gm)).toHaveLength(4);
    expect(timer).toContain("Persistent=true");
    expect(syncScript).toContain('max_batches="${JOBTRACE_SYNC_MAX_BATCHES:-30}"');
    expect(syncScript).toContain("claimed < batch_size");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("schedule:");
    expect(workflow).toContain("production synchronization is handled by the server timer");
  });
});
