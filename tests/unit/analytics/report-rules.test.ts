import { describe, expect, it } from "vitest";
import { buildAnalyticsReportFromAggregates } from "@/modules/analytics/application/report-rules";
import { resolveAnalyticsRange } from "@/modules/analytics/application/report-query";

const query = resolveAnalyticsRange(
  {
    period: "90d",
    type: undefined,
    city: undefined,
    hasCityFilter: false,
  },
  "2026-08-21",
);

describe("求职分析聚合规则", () => {
  it("数据库聚合结果保持相同的指标和小样本规则", () => {
    const report = buildAnalyticsReportFromAggregates({
      query,
      availableCities: ["上海"],
      current: {
        metrics: {
          applications: 3,
          interviewed: 2,
          offers: 2,
          finalInterviews: 1,
          pathOffers: 1,
          medianDaysToFirstInterview: 7.5,
          offersWithoutInterview: 1,
          offersWithoutFinal: 0,
        },
        reviewMetrics: { total: 2, completed: 1, resolved: 1, passed: 1 },
        trend: [
          {
            periodStart: "2026-06-29",
            label: "06/29",
            applications: 3,
            interviewed: 2,
            offers: 2,
          },
        ],
        stageReach: [
          { stage: "screening", count: 3 },
          { stage: "interview_1", count: 2 },
          { stage: "final_interview", count: 1 },
        ],
        typeBreakdown: [
          {
            key: "campus_recruitment",
            applications: 3,
            interviewed: 2,
            offers: 2,
          },
        ],
        cityBreakdown: [
          {
            key: "上海",
            applications: 3,
            interviewed: 2,
            offers: 2,
          },
        ],
        reviewsByStage: [
          {
            stage: "interview_1",
            total: 2,
            results: { pending: 1, passed: 1, failed: 0 },
          },
        ],
      },
    });
    expect(report.metrics).toMatchObject({
      applications: { value: 3 },
      interviewRate: { value: 66.7 },
      offerRate: { value: 66.7 },
      medianDaysToFirstInterview: { value: 7.5 },
      reviewCompletionRate: { value: 50 },
    });
    expect(report.milestones.map((item) => item.count)).toEqual([3, 2, 1, 1]);
    expect(report.dataQuality[0]).toContain("1 条 Offer 未记录面试阶段");
    expect(report.sampleSufficient).toBe(false);
  });

  it("样本充足时生成周期变化、最大流失和最佳维度摘要", () => {
    const report = buildAnalyticsReportFromAggregates({
      query,
      availableCities: ["北京"],
      previous: {
        metrics: {
          applications: 4,
          interviewed: 2,
          offers: 1,
          finalInterviews: 1,
          pathOffers: 1,
          medianDaysToFirstInterview: 8,
          offersWithoutInterview: 0,
          offersWithoutFinal: 0,
        },
        reviewMetrics: { total: 2, completed: 1, resolved: 1, passed: 1 },
      },
      current: {
        metrics: {
          applications: 5,
          interviewed: 3,
          offers: 2,
          finalInterviews: 1,
          pathOffers: 1,
          medianDaysToFirstInterview: 6,
          offersWithoutInterview: 0,
          offersWithoutFinal: 1,
        },
        reviewMetrics: { total: 3, completed: 2, resolved: 2, passed: 1 },
        trend: [],
        stageReach: [
          { stage: "screening", count: 5 },
          { stage: "interview_1", count: 3 },
        ],
        typeBreakdown: [
          {
            key: "campus_recruitment",
            applications: 5,
            interviewed: 3,
            offers: 2,
          },
        ],
        cityBreakdown: [
          { key: "北京", applications: 5, interviewed: 3, offers: 2 },
        ],
        reviewsByStage: [],
      },
    });

    expect(report.sampleSufficient).toBe(true);
    expect(report.metrics.applications.delta).toBe(25);
    expect(report.summary.some((item) => item.includes("最大流失"))).toBe(true);
    expect(report.summary.some((item) => item.includes("秋招"))).toBe(true);
    expect(report.dataQuality[0]).toContain("已记录面试但未记录终面");
  });
});
