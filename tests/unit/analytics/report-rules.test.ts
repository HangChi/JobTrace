import { describe, expect, it } from "vitest";
import {
  buildAnalyticsReport,
  buildAnalyticsReportFromAggregates,
} from "@/modules/analytics/application/report-rules";
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
  it("按独立投递计算阶段、漏斗、面经分母和数据完整性", () => {
    const report = buildAnalyticsReport({
      query,
      availableCities: ["上海"],
      applications: [
        {
          id: "a",
          appliedDate: "2026-07-01",
          type: "campus_recruitment",
          city: "上海",
          status: "offer",
          stages: ["screening", "interview_1", "final_interview"],
          firstInterviewOn: "2026-07-11",
        },
        {
          id: "b",
          appliedDate: "2026-07-02",
          type: "campus_recruitment",
          city: null,
          status: "offer",
          stages: ["screening"],
          firstInterviewOn: null,
        },
        {
          id: "c",
          appliedDate: "2026-07-03",
          type: "social_recruitment",
          city: "上海",
          status: "refused",
          stages: ["screening", "interview_1"],
          firstInterviewOn: "2026-07-08",
        },
      ],
      comparisonApplications: [],
      reviews: [
        {
          applicationId: "a",
          stage: "final_interview",
          status: "completed",
          result: "passed",
        },
        {
          applicationId: "c",
          stage: "interview_1",
          status: "draft",
          result: "pending",
        },
      ],
      comparisonReviews: [],
    });

    expect(report.metrics.applications.value).toBe(3);
    expect(report.metrics.interviewRate.value).toBe(66.7);
    expect(report.metrics.offerRate.value).toBe(66.7);
    expect(report.metrics.medianDaysToFirstInterview.value).toBe(7.5);
    expect(report.milestones.map((item) => item.count)).toEqual([3, 2, 1, 1]);
    expect(
      report.stageReach.find((item) => item.stage === "interview_1")?.count,
    ).toBe(2);
    expect(report.interviews).toMatchObject({
      total: 2,
      completed: 1,
      resolved: 1,
      passed: 1,
      passRate: 100,
    });
    expect(report.dataQuality[0]).toContain("1 条 Offer 未记录面试阶段");
    expect(report.sampleSufficient).toBe(false);
  });

  it("样本充足时生成最大流失和最佳维度摘要", () => {
    const applications = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      appliedDate: `2026-07-0${index + 1}`,
      type: "campus_recruitment" as const,
      city: "北京",
      status: index < 2 ? ("offer" as const) : ("submitted" as const),
      stages:
        index < 3
          ? (["screening", "interview_1"] as const)
          : (["screening"] as const),
      firstInterviewOn: index < 3 ? `2026-07-1${index + 1}` : null,
    }));
    const report = buildAnalyticsReport({
      query,
      applications: applications.map((item) => ({
        ...item,
        stages: [...item.stages],
      })),
      comparisonApplications: [],
      reviews: [],
      comparisonReviews: [],
      availableCities: ["北京"],
    });
    expect(report.sampleSufficient).toBe(true);
    expect(report.summary.some((item) => item.includes("最大流失"))).toBe(true);
    expect(report.summary.some((item) => item.includes("秋招"))).toBe(true);
    expect(report.metrics.reviewCompletionRate.value).toBeNull();
  });

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
});
