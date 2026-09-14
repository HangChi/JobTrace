import { describe, expect, it } from "vitest";
import { formatPublicationDate } from "@/modules/interviews/ui/format-publication-date";

describe("公开面经发布时间", () => {
  it("在所有界面按 Asia/Shanghai 输出同一日期", () => {
    expect(formatPublicationDate("2026-09-13T16:30:00.000Z")).toBe(
      "2026年9月14日",
    );
  });
});
