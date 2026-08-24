import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AdminSummary } from "@/modules/identity-access/ui/admin-summary";

const base = {
  generatedAt: "2026-08-24T00:00:00.000Z",
  timeZone: "Asia/Shanghai" as const,
  activityDefinition: "有效登录会话",
};

describe("AdminSummary", () => {
  test("renders real zero values and the activity definition", () => {
    render(
      <AdminSummary
        summary={{
          ...base,
          counts: {
            status: "available",
            value: {
              users: 0,
              activeUsers: 0,
              disabledUsers: 0,
              administrators: 0,
              applications: 0,
              interviews: 0,
            },
          },
          activity: {
            status: "available",
            windows: {
              registered7d: 0,
              active7d: 0,
              registered30d: 0,
              active30d: 0,
            },
            dailyTrend: [],
          },
        }}
      />,
    );
    expect(screen.getAllByText("0")).toHaveLength(10);
    expect(screen.getByText("有效登录会话")).toBeVisible();
  });

  test("does not disguise unavailable data as zero", () => {
    render(
      <AdminSummary
        summary={{
          ...base,
          counts: { status: "unavailable" },
          activity: { status: "unavailable" },
        }}
      />,
    );
    expect(screen.getByText(/平台总量暂时无法取得/)).toBeVisible();
    expect(screen.getByText(/未知值未按零计算/)).toBeVisible();
  });
});
