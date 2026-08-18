import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationStatusSelect } from "@/modules/applications/ui/application-status-select";
import type { ApplicationDetail } from "@/modules/applications";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const application: ApplicationDetail = {
  id: "application-1",
  companyName: "测试公司",
  positionName: "开发工程师",
  city: "上海",
  jobUrl: null,
  appliedDate: "2026-08-10",
  type: "campus_recruitment",
  status: "submitted",
  latestDate: "2026-08-10",
  stages: ["screening"],
  needsFollowUp: false,
  followUpDays: 0,
  followUpReason: null,
  version: 1,
  notes: null,
  stageOccurrences: [],
  events: [],
  createdAt: "2026-08-10T00:00:00Z",
  updatedAt: "2026-08-10T00:00:00Z",
};

describe("表格状态下拉框", () => {
  it("选择状态后在当前页面保存", async () => {
    const updated = { ...application, status: "offer" as const, version: 2 };
    const request = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => application })
      .mockResolvedValueOnce({ ok: true, json: async () => updated });
    vi.stubGlobal("fetch", request);
    render(<ApplicationStatusSelect application={application} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "测试公司 投递状态，当前已投递",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Offer" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "测试公司 投递状态，当前Offer",
        }),
      ).toBeInTheDocument(),
    );
    expect(request).toHaveBeenLastCalledWith(
      "/api/applications/application-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('\"status\":\"offer\"'),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("保存失败后恢复原状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => application })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: "状态保存失败" }),
        }),
    );
    render(<ApplicationStatusSelect application={application} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "测试公司 投递状态，当前已投递",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "拒绝" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("更新失败");
    expect(
      screen.getByRole("button", {
        name: "测试公司 投递状态，当前已投递",
      }),
    ).toBeInTheDocument();
  });

  it("点击菜单外部后收起状态选项", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ApplicationStatusSelect application={application} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "测试公司 投递状态，当前已投递",
      }),
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
