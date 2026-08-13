import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecruitmentStageTimeline } from "@/modules/applications/ui/recruitment-stage-timeline";
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
  status: "submitted",
  latestDate: "2026-08-11",
  stages: ["screening"],
  needsFollowUp: false,
  followUpDays: 0,
  followUpReason: null,
  version: 2,
  notes: null,
  stageOccurrences: [
    { id: "stage-1", stage: "screening", occurredOn: "2026-08-11" },
  ],
  events: [],
  createdAt: "2026-08-10T00:00:00Z",
  updatedAt: "2026-08-11T00:00:00Z",
};

describe("招聘阶段时间线", () => {
  it.each([
    ["offer", "Offer"],
    ["refused", "拒绝"],
  ] as const)("把当前 %s 状态按更新当天显示到时间线", (status, label) => {
    const terminal: ApplicationDetail = {
      ...application,
      status,
      events: [
        {
          id: `event-${status}`,
          type: "status_changed",
          occurredOn: "2026-08-14",
          before: { status: "submitted" },
          after: { status },
          createdAt: "2026-08-14T01:00:00Z",
        },
      ],
    };

    render(
      <RecruitmentStageTimeline application={terminal} onUpdate={vi.fn()} />,
    );

    const timeline = screen.getByRole("list");
    expect(within(timeline).getByText(label)).toBeVisible();
    expect(within(timeline).getByText("2026-08-14")).toBeVisible();
  });

  it("状态改回已投递后从时间线撤回终态", () => {
    const withdrawn: ApplicationDetail = {
      ...application,
      status: "submitted",
      events: [
        {
          id: "event-offer",
          type: "status_changed",
          occurredOn: "2026-08-14",
          before: { status: "submitted" },
          after: { status: "offer" },
          createdAt: "2026-08-14T01:00:00Z",
        },
        {
          id: "event-withdrawn",
          type: "status_changed",
          occurredOn: "2026-08-14",
          before: { status: "offer" },
          after: { status: "submitted" },
          createdAt: "2026-08-14T02:00:00Z",
        },
      ],
    };

    render(
      <RecruitmentStageTimeline application={withdrawn} onUpdate={vi.fn()} />,
    );

    expect(screen.queryByText("Offer")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByText("简历筛选"),
    ).toBeVisible();
  });

  it("点击已记录阶段可取消最近一次状态更新", async () => {
    const updated: ApplicationDetail = {
      ...application,
      stages: [],
      stageOccurrences: [],
      version: 3,
    };
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => updated,
    });
    vi.stubGlobal("fetch", request);
    const onUpdate = vi.fn();
    render(
      <RecruitmentStageTimeline
        application={application}
        onUpdate={onUpdate}
      />,
    );

    const stage = screen.getByRole("button", { name: /简历筛选/ });
    fireEvent.click(stage);
    const confirmation = screen.getByRole("group", {
      name: "取消阶段更新",
    });
    expect(within(confirmation).getByText("准备取消")).toBeVisible();
    expect(within(confirmation).getByText("2026-08-11")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "确认取消" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updated));
    expect(request).toHaveBeenCalledWith(
      "/api/applications/application-1/stages/stage-1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ changeDate: "2026-08-14" }),
      }),
    );
  });

  it("点击阶段后可选择过去日期并用接口结果更新时间线", async () => {
    const updated: ApplicationDetail = {
      ...application,
      latestDate: "2026-08-13",
      version: 3,
      stages: ["screening", "assessment"],
      stageOccurrences: [
        ...application.stageOccurrences,
        { id: "stage-2", stage: "assessment", occurredOn: "2026-08-13" },
      ],
    };
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => updated,
    });
    vi.stubGlobal("fetch", request);
    const onUpdate = vi.fn();
    render(
      <RecruitmentStageTimeline
        application={application}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("当前：简历筛选")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /测评/ }));
    const date = screen.getByLabelText("发生日期");
    expect(date).toHaveAttribute("min", "2026-08-10");
    expect(date).toHaveAttribute("max", "2026-08-14");
    fireEvent.change(date, { target: { value: "2026-08-13" } });
    fireEvent.click(screen.getByRole("button", { name: "确认更新" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updated));
    expect(request).toHaveBeenCalledWith(
      "/api/applications/application-1/stages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          stage: "assessment",
          occurredOn: "2026-08-13",
        }),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("接口失败时保留原时间线并显示错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "阶段更新失败" }),
      }),
    );
    render(
      <RecruitmentStageTimeline application={application} onUpdate={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /笔试/ }));
    fireEvent.click(screen.getByRole("button", { name: "确认更新" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("阶段更新失败");
    expect(screen.getByText("2026-08-11")).toBeVisible();
  });
});
