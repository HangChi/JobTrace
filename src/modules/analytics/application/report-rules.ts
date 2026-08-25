import {
  RECRUITMENT_STAGES,
  TYPE_LABELS,
  type ApplicationType,
  type RecruitmentStage,
} from "@/modules/applications/domain/catalog";
import type {
  AnalyticsDimensionRow,
  AnalyticsMilestone,
  AnalyticsReport,
  AnalyticsResolvedRange,
  AnalyticsTrendPoint,
  InterviewStageResult,
  MetricComparison,
} from "./contracts";

export type ReportAggregateData = {
  metrics: {
    applications: number;
    interviewed: number;
    offers: number;
    finalInterviews: number;
    pathOffers: number;
    medianDaysToFirstInterview: number | null;
    offersWithoutInterview: number;
    offersWithoutFinal: number;
  };
  reviewMetrics: {
    total: number;
    completed: number;
    resolved: number;
    passed: number;
  };
  trend: AnalyticsTrendPoint[];
  stageReach: Array<{ stage: RecruitmentStage; count: number }>;
  typeBreakdown: Array<{
    key: ApplicationType;
    applications: number;
    interviewed: number;
    offers: number;
  }>;
  cityBreakdown: Array<{
    key: string;
    applications: number;
    interviewed: number;
    offers: number;
  }>;
  reviewsByStage: InterviewStageResult[];
};

const rate = (part: number, total: number) =>
  total ? (part / total) * 100 : 0;
const rounded = (value: number) => Math.round(value * 10) / 10;

function metric(
  value: number | null,
  previous: number | null,
  deltaKind: MetricComparison["deltaKind"],
): MetricComparison {
  let delta: number | null = null;
  if (value !== null && previous !== null) {
    delta =
      deltaKind === "percentage_point"
        ? rounded(value - previous)
        : previous === 0
          ? value === 0
            ? 0
            : null
          : rounded(((value - previous) / previous) * 100);
  }
  return {
    value: value === null ? null : rounded(value),
    previous,
    delta,
    deltaKind,
  };
}

function dimensionFromAggregates(
  rows: Array<{
    key: string;
    applications: number;
    interviewed: number;
    offers: number;
  }>,
  labelFor: (key: string) => string,
): AnalyticsDimensionRow[] {
  return rows
    .map((row) => ({
      key: row.key,
      label: labelFor(row.key),
      applications: row.applications,
      interviewRate: rounded(rate(row.interviewed, row.applications)),
      offerRate: rounded(rate(row.offers, row.applications)),
      sampleSufficient: row.applications >= 5,
    }))
    .sort(
      (a, b) =>
        b.applications - a.applications ||
        a.label.localeCompare(b.label, "zh-CN"),
    );
}

function aggregateCityRows(rows: ReportAggregateData["cityBreakdown"]) {
  const sorted = [...rows].sort(
    (a, b) => b.applications - a.applications || a.key.localeCompare(b.key),
  );
  const visible = sorted.slice(0, 8);
  if (sorted.length > 8) {
    visible.push(
      sorted.slice(8).reduce(
        (total, row) => ({
          key: "__other__",
          applications: total.applications + row.applications,
          interviewed: total.interviewed + row.interviewed,
          offers: total.offers + row.offers,
        }),
        { key: "__other__", applications: 0, interviewed: 0, offers: 0 },
      ),
    );
  }
  return dimensionFromAggregates(visible, (key) =>
    key === "__other__" ? "其他" : key || "未填写",
  );
}

export function buildAnalyticsReportFromAggregates(input: {
  query: AnalyticsResolvedRange;
  current: ReportAggregateData;
  previous?: Pick<ReportAggregateData, "metrics" | "reviewMetrics">;
  availableCities: string[];
}): AnalyticsReport {
  const { current, previous } = input;
  const currentCompletion = current.reviewMetrics.total
    ? rate(current.reviewMetrics.completed, current.reviewMetrics.total)
    : null;
  const previousCompletion = previous?.reviewMetrics.total
    ? rate(previous.reviewMetrics.completed, previous.reviewMetrics.total)
    : null;
  const milestones: AnalyticsMilestone[] = [
    {
      key: "applications",
      label: "投递",
      count: current.metrics.applications,
      conversionFromPrevious: null,
    },
    {
      key: "interviewed",
      label: "有面试记录",
      count: current.metrics.interviewed,
      conversionFromPrevious: rounded(
        rate(current.metrics.interviewed, current.metrics.applications),
      ),
    },
    {
      key: "finalInterview",
      label: "进入终面",
      count: current.metrics.finalInterviews,
      conversionFromPrevious: rounded(
        rate(current.metrics.finalInterviews, current.metrics.interviewed),
      ),
    },
    {
      key: "pathOffers",
      label: "终面后 Offer",
      count: current.metrics.pathOffers,
      conversionFromPrevious: rounded(
        rate(current.metrics.pathOffers, current.metrics.finalInterviews),
      ),
    },
  ];
  const biggestDrop = milestones
    .slice(1)
    .map((item, index) => ({
      from: milestones[index].label,
      to: item.label,
      count: milestones[index].count - item.count,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const typeBreakdown = dimensionFromAggregates(
    current.typeBreakdown,
    (key) => TYPE_LABELS[key as ApplicationType],
  );
  const cities = aggregateCityRows(current.cityBreakdown);
  const sampleSufficient = current.metrics.applications >= 5;
  const summary: string[] = [];
  if (!sampleSufficient && current.metrics.applications)
    summary.push("当前仅有少量投递记录，先积累更多样本再判断维度差异。");
  if (previous && previous.metrics.applications > 0) {
    const change = metric(
      current.metrics.applications,
      previous.metrics.applications,
      "percent",
    ).delta;
    if (change !== null)
      summary.push(
        `本周期投递量较上一周期${change >= 0 ? "增加" : "减少"} ${Math.abs(change)}%。`,
      );
  }
  if (sampleSufficient && biggestDrop?.count)
    summary.push(
      `记录中的最大流失发生在“${biggestDrop.from} → ${biggestDrop.to}”，共减少 ${biggestDrop.count} 个机会。`,
    );
  const eligible = [...typeBreakdown, ...cities].filter(
    (item) => item.sampleSufficient,
  );
  if (sampleSufficient && eligible.length) {
    const best = eligible.sort(
      (a, b) =>
        b.offerRate - a.offerRate ||
        b.interviewRate - a.interviewRate ||
        b.applications - a.applications,
    )[0];
    summary.push(
      `有效样本中，“${best.label}”的 Offer 率最高，为 ${best.offerRate}%。`,
    );
  }
  const dataQuality: string[] = [];
  if (current.metrics.offersWithoutInterview)
    dataQuality.push(
      `${current.metrics.offersWithoutInterview} 条 Offer 未记录面试阶段，已计入总体 Offer 率但未进入里程碑漏斗。`,
    );
  if (current.metrics.offersWithoutFinal)
    dataQuality.push(
      `${current.metrics.offersWithoutFinal} 条 Offer 已记录面试但未记录终面，因此未进入漏斗最后一步。`,
    );

  return {
    query: input.query,
    availableCities: input.availableCities,
    metrics: {
      applications: metric(
        current.metrics.applications,
        previous?.metrics.applications ?? null,
        "percent",
      ),
      interviewRate: metric(
        rate(current.metrics.interviewed, current.metrics.applications),
        previous
          ? rate(previous.metrics.interviewed, previous.metrics.applications)
          : null,
        "percentage_point",
      ),
      offerRate: metric(
        rate(current.metrics.offers, current.metrics.applications),
        previous
          ? rate(previous.metrics.offers, previous.metrics.applications)
          : null,
        "percentage_point",
      ),
      medianDaysToFirstInterview: metric(
        current.metrics.medianDaysToFirstInterview,
        previous?.metrics.medianDaysToFirstInterview ?? null,
        "percent",
      ),
      reviewCompletionRate: metric(
        currentCompletion,
        previousCompletion,
        "percentage_point",
      ),
    },
    trend: current.trend,
    milestones,
    biggestDrop,
    stageReach: RECRUITMENT_STAGES.map((stage) => {
      const count =
        current.stageReach.find((item) => item.stage === stage)?.count ?? 0;
      return {
        stage,
        count,
        rate: rounded(rate(count, current.metrics.applications)),
      };
    }),
    typeBreakdown,
    cityBreakdown: cities,
    interviews: {
      total: current.reviewMetrics.total,
      completed: current.reviewMetrics.completed,
      completionRate: rounded(currentCompletion ?? 0),
      resolved: current.reviewMetrics.resolved,
      passed: current.reviewMetrics.passed,
      passRate: rounded(
        rate(current.reviewMetrics.passed, current.reviewMetrics.resolved),
      ),
      byStage: current.reviewsByStage,
    },
    summary,
    dataQuality,
    sampleSufficient,
  };
}
