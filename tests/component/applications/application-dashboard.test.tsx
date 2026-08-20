import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationDashboard } from "@/modules/applications/ui/application-dashboard";
import type { AnalyticsSummary } from "@/modules/analytics";
import type { ApplicationPage } from "@/modules/applications";

vi.mock("@/modules/analytics/ui/analytics-panel", () => ({
  AnalyticsPanel: ({ summary }: { summary: AnalyticsSummary }) => (
    <span data-testid="summary-total">{summary.total}</span>
  ),
}));
vi.mock("@/modules/applications/ui/application-table", () => ({
  ApplicationTable: ({ page }: { page: ApplicationPage }) => (
    <span data-testid="current-page">
      {page.page}:{page.items[0]?.companyName}
    </span>
  ),
}));
vi.mock("@/modules/applications/ui/application-filters", () => ({
  ApplicationFilters: () => null,
}));
vi.mock("@/modules/applications/ui/application-list-empty", () => ({
  ApplicationListEmpty: () => null,
}));
vi.mock("@/modules/applications/ui/application-dialogs", () => ({
  NewApplicationDialog: () => null,
}));
vi.mock("@/modules/applications/ui/reset-page-on-reload", () => ({
  ResetPageOnReload: () => null,
}));
vi.mock("@/modules/data-transfer/ui/export-button", () => ({
  ExportButton: () => null,
}));

function applicationPage(page: number, companyName: string): ApplicationPage {
  return {
    page,
    limit: 10,
    total: 20,
    nextCursor: null,
    items: [
      {
        id: `application-${page}`,
        companyName,
        positionName: "工程师",
        city: null,
        jobUrl: null,
        appliedDate: "2026-08-18",
        type: "campus_recruitment",
        status: "submitted",
        latestDate: "2026-08-18",
        stages: [],
        needsFollowUp: false,
        followUpDays: 0,
        followUpReason: null,
        version: 1,
      },
    ],
  };
}

function summary(total: number): AnalyticsSummary {
  return {
    total,
    submitted: total,
    refused: 0,
    offers: 0,
    addedThisWeek: 0,
    stageDistribution: {},
    followUps: [],
    progressReminders: [],
  };
}

describe("投递 Dashboard 分页同步", () => {
  it("客户端分页导航后使用新的服务端分页数据", () => {
    const view = render(
      <ApplicationDashboard
        key="limit=10"
        initialPage={applicationPage(1, "第一页公司")}
        initialSummary={summary(20)}
        query={{}}
        filtered={false}
        listQuery="limit=10"
        exportQuery=""
      />,
    );
    expect(screen.getByTestId("current-page")).toHaveTextContent(
      "1:第一页公司",
    );

    view.rerender(
      <ApplicationDashboard
        key="limit=10&page=2"
        initialPage={applicationPage(2, "第二页公司")}
        initialSummary={summary(19)}
        query={{ page: "2" }}
        filtered={false}
        listQuery="limit=10&page=2"
        exportQuery=""
      />,
    );

    expect(screen.getByTestId("current-page")).toHaveTextContent(
      "2:第二页公司",
    );
    expect(screen.getByTestId("summary-total")).toHaveTextContent("19");
  });
});
