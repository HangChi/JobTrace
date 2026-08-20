import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressReminderList } from "@/modules/analytics/ui/progress-reminder-list";

describe("待处理进展列表", () => {
  it("展示阶段信息并提供对应操作", () => {
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
    expect(screen.getByRole("link", { name: "补充测评结果" })).toHaveAttribute(
      "href",
      "/applications/application-1",
    );
    expect(screen.getByRole("link", { name: "继续完成复盘" })).toHaveAttribute(
      "href",
      "/interviews/review-2",
    );
  });

  it("没有提醒时不占用布局", () => {
    const { container } = render(<ProgressReminderList items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
