import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReminderPanel } from "@/modules/reminders/ui/reminder-panel";
import type { Reminder } from "@/modules/reminders";

const base: Reminder = {
  id: crypto.randomUUID(),
  applicationId: crypto.randomUUID(),
  sourceStageOccurrenceId: null,
  companyName: "示例公司",
  positionName: "工程师",
  title: "跟进招聘进度",
  eventAt: "2026-10-08T06:00:00.000Z",
  notifyAt: "2026-10-08T05:00:00.000Z",
  emailEnabled: false,
  status: "pending",
  version: 1,
  emailStatus: null,
  completedAt: null,
  cancelledAt: null,
};

describe("ReminderPanel", () => {
  it("groups due and upcoming reminders with lifecycle actions", () => {
    render(
      <ReminderPanel
        preferences={{
          homeEnabled: true,
          homeView: "scheduled",
          defaultLead: "1h",
          defaultSnoozeMinutes: 30,
          emailDefault: false,
        }}
        initialSummary={{
          overdue: [
            {
              ...base,
              id: crypto.randomUUID(),
              status: "due",
              title: "已到时间事项",
            },
          ],
          upcoming: [{ ...base, id: crypto.randomUUID(), title: "未来事项" }],
          history: [],
          email: { available: false, address: null },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: /已到时间/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: /接下来/ })).toBeVisible();
    expect(screen.getByText("已到时间事项")).toBeVisible();
    expect(screen.getByText("未来事项")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "完成" })).toHaveLength(2);
    expect(screen.getAllByText("稍后提醒")).toHaveLength(2);
    expect(screen.queryAllByText("30 分钟")).toHaveLength(2);
  });

  it("shows a directional empty state", () => {
    render(
      <ReminderPanel
        preferences={{
          homeEnabled: true,
          homeView: "scheduled",
          defaultLead: "1h",
          defaultSnoozeMinutes: 30,
          emailDefault: false,
        }}
        initialSummary={{
          overdue: [],
          upcoming: [],
          history: [],
          email: { available: false, address: null },
        }}
      />,
    );
    expect(
      screen.getByText("暂无待处理提醒，可从投递详情设置。"),
    ).toBeVisible();
  });
});
