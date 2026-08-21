import { describe, expect, it } from "vitest";
import {
  parseAnalyticsReportQuery,
  resolveAnalyticsRange,
} from "@/modules/analytics/application/report-query";

describe("求职分析时间范围", () => {
  it("默认最近 90 天并计算上一等长周期", () => {
    const query = resolveAnalyticsRange(
      parseAnalyticsReportQuery(new URLSearchParams()),
      "2026-08-21",
    );
    expect(query).toMatchObject({
      period: "90d",
      from: "2026-05-24",
      to: "2026-08-21",
      comparisonFrom: "2026-02-23",
      comparisonTo: "2026-05-23",
      granularity: "week",
    });
  });

  it("今年使用上年同期，全部历史没有比较周期", () => {
    expect(
      resolveAnalyticsRange(
        parseAnalyticsReportQuery(new URLSearchParams("period=ytd")),
        "2026-08-21",
      ),
    ).toMatchObject({
      from: "2026-01-01",
      to: "2026-08-21",
      comparisonFrom: "2025-01-01",
      comparisonTo: "2025-08-21",
      granularity: "month",
    });
    expect(
      resolveAnalyticsRange(
        parseAnalyticsReportQuery(new URLSearchParams("period=all")),
        "2026-08-21",
      ),
    ).toMatchObject({ from: undefined, to: undefined });
  });

  it("保留并拒绝无效的自定义日期", () => {
    const query = resolveAnalyticsRange(
      parseAnalyticsReportQuery(
        new URLSearchParams(
          "period=custom&from=2026-09-01&to=2026-08-21&type=campus_recruitment&city=",
        ),
      ),
      "2026-08-21",
    );
    expect(query.error).toBe("开始日期不能晚于结束日期。");
    expect(query).toMatchObject({
      type: "campus_recruitment",
      city: "",
      hasCityFilter: true,
    });
    expect(
      resolveAnalyticsRange(
        parseAnalyticsReportQuery(
          new URLSearchParams("period=custom&from=2026-02-31&to=2026-03-01"),
        ),
        "2026-08-21",
      ).error,
    ).toBe("请选择完整且有效的开始与结束日期。");
  });

  it("接受秋招提前批筛选", () => {
    expect(
      parseAnalyticsReportQuery(
        new URLSearchParams("period=90d&type=early_campus_recruitment"),
      ).type,
    ).toBe("early_campus_recruitment");
  });
});
