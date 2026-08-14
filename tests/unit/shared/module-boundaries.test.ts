import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("client module boundaries", () => {
  it("forbids UI modules from importing server database and infrastructure adapters", async () => {
    const config = await readFile("eslint.config.mjs", "utf8");
    expect(config).toContain('"src/modules/*/ui/**/*.{ts,tsx}"');
    expect(config).toContain('"@/shared/database/**"');
    expect(config).toContain('"@/modules/*/infrastructure/**"');
    expect(config).not.toContain("supabase.admin.server");
  });
});
