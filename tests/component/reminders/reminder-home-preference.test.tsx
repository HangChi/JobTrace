import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalyticsPanel } from "@/modules/analytics/ui/analytics-panel";
import type { AnalyticsSummary } from "@/modules/analytics";
import type { ReminderSummary } from "@/modules/reminders";

const summary: AnalyticsSummary = {
  total: 0,
  submitted: 0,
  refused: 0,
  offers: 0,
  addedThisWeek: 0,
  stageDistribution: {},
  followUps: [],
  progressReminders: [],
};
const summaryWithSuggestion: AnalyticsSummary = {
  ...summary,
  progressReminders: [
    {
      id: "stage-1",
      applicationId: "application-1",
      companyName: "示例公司",
      positionName: "工程师",
      city: "上海",
      stageOccurrenceId: "stage-1",
      stage: "interview_1",
      occurredOn: "2026-09-27",
      reviewId: null,
      reviewStatus: null,
    },
  ],
};
const reminders: ReminderSummary = {
  overdue: [],
  upcoming: [],
  history: [],
  email: { available: false, address: null },
};

describe("homepage reminder preference", () => {
  it("shows scheduled reminders without the system suggestion panel", () => {
    render(
      <AnalyticsPanel
        summary={summary}
        reminderSummary={reminders}
        reminderPreferences={{
          homeEnabled: true,
          homeView: "scheduled",
          defaultLead: "1h",
          defaultSnoozeMinutes: 30,
          emailDefault: false,
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "提醒与待办" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "系统建议" }),
    ).not.toBeInTheDocument();
  });

  it("shows system suggestions without the scheduled reminder panel", () => {
    render(
      <AnalyticsPanel
        summary={summaryWithSuggestion}
        reminderSummary={reminders}
        reminderPreferences={{
          homeEnabled: true,
          homeView: "suggestions",
          defaultLead: "1h",
          defaultSnoozeMinutes: 30,
          emailDefault: false,
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "系统建议" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "提醒与待办" }),
    ).not.toBeInTheDocument();
  });
});
