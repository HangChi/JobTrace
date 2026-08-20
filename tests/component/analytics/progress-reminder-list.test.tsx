import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressReminderList } from "@/modules/analytics/ui/progress-reminder-list";

describe("待处理进展列表", () => {
  it("展示阶段信息、日期并提供完成操作", () => {
    render(
      <ProgressReminderList
        items={[
          {
            id: "stage-1",
            applicationId: "application-1",
            companyName: "华为",
            positionName: "后端工程师",
            city: "上海，北京",
            stageOccurrenceId: "stage-1",
            stage: "assessment",
            occurredOn: "2026-08-19",
            reviewId: null,
            reviewStatus: null,
          },
          {
            id: "stage-2",
            applicationId: "application-2",
            companyName: "腾讯",
            positionName: "前端工程师",
            city: "深圳",
            stageOccurrenceId: "stage-2",
            stage: "interview_1",
            occurredOn: "2026-08-18",
            reviewId: "review-2",
            reviewStatus: "pending_review",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "待处理进展" })).toBeVisible();
    expect(screen.getByText("华为（上海，北京）")).toBeVisible();
    expect(screen.getByText("腾讯（深圳）")).toBeVisible();
    expect(screen.getByText(/2026-08-19/)).toBeVisible();
    expect(screen.queryByText(/进展日期/)).toBeNull();
    expect(screen.queryByRole("link", { name: "补充测评结果" })).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "不再提醒" })).toHaveLength(2);
  });

  it("没有提醒时不占用布局", () => {
    const { container } = render(<ProgressReminderList items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("点击不再提醒后立即移除，并持久化处理状态", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ completed: true })));
    render(
      <ProgressReminderList
        items={[
          {
            id: "stage-3",
            applicationId: "application-3",
            companyName: "字节跳动",
            positionName: "产品经理",
            city: "北京",
            stageOccurrenceId: "stage-3",
            stage: "written_test",
            occurredOn: "2026-08-20",
            reviewId: null,
            reviewStatus: null,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "不再提醒" }));
    await waitFor(() =>
      expect(screen.queryByText("字节跳动（北京）")).toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/progress-reminders/stage-3/complete",
      { method: "POST" },
    );
    fetchMock.mockRestore();
  });
});
