import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationTable } from "@/modules/applications/ui/application-table";
import type { ApplicationDetail } from "@/modules/applications";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const application: ApplicationDetail = {
  id: "application-1",
  companyName: "测试科技",
  positionName: "前端工程师",
  city: "上海",
  jobUrl: "https://example.com/job",
  appliedDate: "2026-08-13",
  type: "summer_internship",
  status: "submitted",
  latestDate: "2026-08-13",
  stages: ["screening"],
  needsFollowUp: false,
  followUpDays: 0,
  followUpReason: null,
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
      <ApplicationTable
        page={{
          items: [application],
          nextCursor: null,
          total: 241,
          page: 6,
          limit: 20,
        }}
        query={{ limit: "20" }}
      />,
    );
    expect(
      screen.getByRole("link", { name: /打开 测试科技（上海） 的投递链接/ }),
    ).toHaveTextContent("example.com");
    expect(screen.getByText("暑期实习")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "编辑" }).querySelector("svg"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "删除" }).querySelector("svg"),
    ).not.toBeNull();
    expect(screen.getByLabelText("每页显示 20 条，打开选项")).toBeVisible();
    expect(screen.getByRole("link", { name: "100 条" })).toHaveAttribute(
      "href",
      expect.stringContaining("limit=100"),
    );
    expect(
      screen.getByText("6", { selector: ".pagination-page" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "第 13 页" })).toBeVisible();
    fireEvent.click(
      screen.getByRole("row", {
        name: /查看 测试科技（上海） 前端工程师 详情/,
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { name: "测试科技（上海） · 前端工程师" }),
    ).toBeVisible();
    await waitFor(() => expect(screen.getByText("准备技术面试")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "编辑这条投递" }));
    expect(
      screen.getByRole("heading", { name: "编辑 测试科技（上海）" }),
    ).toBeVisible();
    expect(screen.getByLabelText("公司名称 *")).toHaveValue("测试科技");
  });

  it("支持选择当前页记录、导出所选并确认批量删除", async () => {
    const onMutation = vi.fn();
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deletedCount: 1 }),
    });
    vi.stubGlobal("fetch", fetch);

    render(
      <ApplicationTable
        page={{
          items: [
            application,
            {
              ...application,
              id: "application-2",
              companyName: "另一家公司",
            },
          ],
          nextCursor: null,
          total: 2,
          page: 1,
          limit: 10,
        }}
        onMutation={onMutation}
      />,
    );

    fireEvent.click(screen.getByLabelText("选择 测试科技（上海） 前端工程师"));
    expect(
      screen.getByText("1", { selector: ".bulk-selection-count strong" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Excel 工作簿/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/scope=selected.*format=xlsx.*id=application-1/),
    );

    fireEvent.click(screen.getByRole("button", { name: "删除所选" }));
    expect(
      screen.getByRole("heading", { name: "删除所选的 1 条投递？" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "确认删除 1 条" }));

    await waitFor(() => expect(onMutation).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/applications",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ ids: ["application-1"] }),
      }),
    );
    expect(screen.getByText("已删除 1 条投递记录。")).toBeVisible();
  });

  it("支持全选和取消选择当前页", () => {
    render(
      <ApplicationTable
        page={{
          items: [application, { ...application, id: "application-2" }],
          nextCursor: null,
          total: 2,
          page: 1,
          limit: 10,
        }}
      />,
    );
    const pageSelectors = screen.getAllByLabelText("选择当前页全部 2 条记录");
    fireEvent.click(pageSelectors[0]);
    expect(
      screen.getByText("2", { selector: ".bulk-selection-count strong" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "取消选择" }));
    expect(screen.queryByRole("button", { name: "删除所选" })).toBeNull();
  });
});
