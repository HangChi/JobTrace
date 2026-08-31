import { describe, expect, it } from "vitest";
import { DEFAULT_SOURCE_CATALOG } from "@/modules/job-market/application/default-source-catalog";

describe("default job-market source catalog", () => {
  it("contains unique, bounded, public HTTPS sources", () => {
    expect(DEFAULT_SOURCE_CATALOG.length).toBeGreaterThanOrEqual(5);
    expect(
      new Set(DEFAULT_SOURCE_CATALOG.map((entry) => entry.identityKey)).size,
    ).toBe(DEFAULT_SOURCE_CATALOG.length);
    expect(
      new Set(
        DEFAULT_SOURCE_CATALOG.map(
          (entry) => `${entry.adapter}:${entry.externalKey}`,
        ),
      ).size,
    ).toBe(DEFAULT_SOURCE_CATALOG.length);

    for (const entry of DEFAULT_SOURCE_CATALOG) {
      const sourceUrl = new URL(entry.baseUrl);
      const websiteUrl = new URL(entry.websiteUrl);
      expect(sourceUrl.protocol).toBe("https:");
      expect(websiteUrl.protocol).toBe("https:");
      expect(entry.allowedHosts).toContain(sourceUrl.hostname);
      expect(entry.countryCodes).toEqual(["cn"]);
      expect(entry.syncIntervalMinutes).toBeGreaterThanOrEqual(60);
    }
  });
});
