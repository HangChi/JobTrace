import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationTable } from "@/modules/applications/ui/application-table";
import type { ApplicationDetail } from "@/modules/applications";

const application: ApplicationDetail = {
  id: "application-1",
  companyName: "测试科技",
  positionName: "前端工程师",
  city: "上海",
  jobUrl: "https://example.com/job",
  appliedDate: "2026-08-13",
  status: "active",
  latestDate: "2026-08-13",
  stages: ["screening"],
  needsFollowUp: false,
  followUpDays: 0,
  version: 1,
  notes: "准备技术面试",
  stageOccurrences: [
    { id: "stage-1", stage: "screening", occurredOn: "2026-08-13" },
  ],
  events: [],
  createdAt: "2026-08-13T00:00:00Z",
  updatedAt: "2026-08-13T00:00:00Z",
};

describe("投递记录列表", () => {
  it("点击记录后在当前页面打开详情弹窗", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => application }),
    );

    render(
      <ApplicationTable page={{ items: [application], nextCursor: null }} />,
    );
    fireEvent.click(
      screen.getByRole("row", { name: /查看 测试科技 前端工程师 详情/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { name: "测试科技 · 前端工程师" }),
    ).toBeVisible();
    await waitFor(() => expect(screen.getByText("准备技术面试")).toBeVisible());
  });
});
