import { format } from "date-fns";
import {
  INTERVIEW_STAGES,
  type InterviewStage,
} from "@/modules/interviews/domain/catalog";
import {
  RECRUITMENT_STAGES,
  TYPE_LABELS,
  type ApplicationType,
  type RecruitmentStage,
} from "@/modules/applications/domain/catalog";
import {
  calendarDaysBetween,
  startOfBusinessWeek,
} from "@/shared/date/business-date";
import type {
  AnalyticsDimensionRow,
  AnalyticsMilestone,
  AnalyticsReport,
  AnalyticsResolvedRange,
  AnalyticsTrendPoint,
  InterviewStageResult,
  MetricComparison,
} from "./contracts";

export type ReportApplicationRow = {
  id: string;
  appliedDate: string;
  type: ApplicationType;
  city: string | null;
  status: "submitted" | "offer" | "refused";
  stages: RecruitmentStage[];
  firstInterviewOn: string | null;
};

export type ReportInterviewRow = {
  applicationId: string;
  stage: InterviewStage;
  status: "draft" | "pending_review" | "completed";
  result: "pending" | "passed" | "failed";
};

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

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function applicationMetrics(
  applications: ReportApplicationRow[],
  reviews: ReportInterviewRow[],
) {
  const interviewed = applications.filter(
    (item) => item.firstInterviewOn,
  ).length;
  const offers = applications.filter((item) => item.status === "offer").length;
  const completed = reviews.filter(
    (item) => item.status === "completed",
  ).length;
  return {
    applications: applications.length,
    interviewRate: rate(interviewed, applications.length),
    offerRate: rate(offers, applications.length),
    medianDaysToFirstInterview: median(
      applications.flatMap((item) =>
        item.firstInterviewOn
          ? [calendarDaysBetween(item.appliedDate, item.firstInterviewOn)]
          : [],
      ),
    ),
    reviewCompletionRate: reviews.length
      ? rate(completed, reviews.length)
      : null,
  };
}

function bucketStart(value: string, granularity: "week" | "month") {
  return granularity === "week"
    ? startOfBusinessWeek(value)
    : `${value.slice(0, 7)}-01`;
}

function buildTrend(
  applications: ReportApplicationRow[],
  granularity: "week" | "month",
): AnalyticsTrendPoint[] {
  const buckets = new Map<string, AnalyticsTrendPoint>();
  for (const item of applications) {
    const key = bucketStart(item.appliedDate, granularity);
    const current = buckets.get(key) ?? {
      periodStart: key,
      label: format(
        new Date(`${key}T12:00:00Z`),
        granularity === "week" ? "MM/dd" : "yyyy/MM",
      ),
      applications: 0,
      interviewed: 0,
      offers: 0,
    };
    current.applications += 1;
    current.interviewed += item.firstInterviewOn ? 1 : 0;
    current.offers += item.status === "offer" ? 1 : 0;
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a, b) =>
    a.periodStart.localeCompare(b.periodStart),
  );
}

function buildDimension(
  applications: ReportApplicationRow[],
  keyFor: (item: ReportApplicationRow) => string,
  labelFor: (key: string) => string,
): AnalyticsDimensionRow[] {
  const groups = new Map<string, ReportApplicationRow[]>();
  for (const item of applications) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      label: labelFor(key),
      applications: items.length,
      interviewRate: rounded(
        rate(
          items.filter((item) => item.firstInterviewOn).length,
          items.length,
        ),
      ),
      offerRate: rounded(
        rate(
          items.filter((item) => item.status === "offer").length,
          items.length,
        ),
      ),
      sampleSufficient: items.length >= 5,
    }))
    .sort(
      (a, b) =>
        b.applications - a.applications ||
        a.label.localeCompare(b.label, "zh-CN"),
    );
}

function cityBreakdown(applications: ReportApplicationRow[]) {
  const rows = buildDimension(
    applications,
    (item) => item.city ?? "",
    (key) => key || "未填写",
  );
  if (rows.length <= 8) return rows;
  const top = rows.slice(0, 8);
  const restKeys = new Set(rows.slice(8).map((row) => row.key));
  const rest = applications.filter((item) => restKeys.has(item.city ?? ""));
  return [
    ...top,
    {
      key: "__other__",
      label: "其他",
      applications: rest.length,
      interviewRate: rounded(
        rate(rest.filter((item) => item.firstInterviewOn).length, rest.length),
      ),
      offerRate: rounded(
        rate(
          rest.filter((item) => item.status === "offer").length,
          rest.length,
        ),
      ),
      sampleSufficient: rest.length >= 5,
    },
  ];
}

export function buildAnalyticsReport(input: {
  query: AnalyticsResolvedRange;
  applications: ReportApplicationRow[];
  comparisonApplications: ReportApplicationRow[];
  reviews: ReportInterviewRow[];
  comparisonReviews: ReportInterviewRow[];
  availableCities: string[];
}): AnalyticsReport {
  const { applications, reviews } = input;
  const current = applicationMetrics(applications, reviews);
  const previous = input.query.comparisonFrom
    ? applicationMetrics(input.comparisonApplications, input.comparisonReviews)
    : null;
  const interviewedIds = new Set(
    applications.filter((item) => item.firstInterviewOn).map((item) => item.id),
  );
  const finalIds = new Set(
    applications
      .filter((item) => item.stages.includes("final_interview"))
      .map((item) => item.id),
  );
  const pathOffers = applications.filter(
    (item) =>
      item.status === "offer" &&
      interviewedIds.has(item.id) &&
      finalIds.has(item.id),
  ).length;
  const milestones: AnalyticsMilestone[] = [
    {
      key: "applications",
      label: "投递",
      count: applications.length,
      conversionFromPrevious: null,
    },
    {
      key: "interviewed",
      label: "有面试记录",
      count: interviewedIds.size,
      conversionFromPrevious: rounded(
        rate(interviewedIds.size, applications.length),
      ),
    },
    {
      key: "finalInterview",
      label: "进入终面",
      count: finalIds.size,
      conversionFromPrevious: rounded(rate(finalIds.size, interviewedIds.size)),
    },
    {
      key: "pathOffers",
      label: "终面后 Offer",
      count: pathOffers,
      conversionFromPrevious: rounded(rate(pathOffers, finalIds.size)),
    },
  ];
  const drops = milestones.slice(1).map((item, index) => ({
    from: milestones[index].label,
    to: item.label,
    count: milestones[index].count - item.count,
  }));
  const biggestDrop = drops.sort((a, b) => b.count - a.count)[0];
  const typeBreakdown = buildDimension(
    applications,
    (item) => item.type,
    (key) => TYPE_LABELS[key as ApplicationType],
  );
  const cities = cityBreakdown(applications);
  const byStage: InterviewStageResult[] = INTERVIEW_STAGES.flatMap((stage) => {
    const stageReviews = reviews.filter((item) => item.stage === stage);
    return stageReviews.length
      ? [
          {
            stage,
            total: stageReviews.length,
            results: {
              pending: stageReviews.filter((item) => item.result === "pending")
                .length,
              passed: stageReviews.filter((item) => item.result === "passed")
                .length,
              failed: stageReviews.filter((item) => item.result === "failed")
                .length,
            },
          },
        ]
      : [];
  });
  const resolved = reviews.filter((item) => item.result !== "pending");
  const passed = resolved.filter((item) => item.result === "passed").length;
  const sampleSufficient = applications.length >= 5;
  const summary: string[] = [];
  if (!sampleSufficient && applications.length)
    summary.push("当前仅有少量投递记录，先积累更多样本再判断维度差异。");
  if (previous && previous.applications > 0) {
    const change = metric(
      current.applications,
      previous.applications,
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
  const offersWithoutInterview = applications.filter(
    (item) => item.status === "offer" && !interviewedIds.has(item.id),
  ).length;
  const offersWithoutFinal = applications.filter(
    (item) =>
      item.status === "offer" &&
      interviewedIds.has(item.id) &&
      !finalIds.has(item.id),
  ).length;
  const dataQuality: string[] = [];
  if (offersWithoutInterview)
    dataQuality.push(
      `${offersWithoutInterview} 条 Offer 未记录面试阶段，已计入总体 Offer 率但未进入里程碑漏斗。`,
    );
  if (offersWithoutFinal)
    dataQuality.push(
      `${offersWithoutFinal} 条 Offer 已记录面试但未记录终面，因此未进入漏斗最后一步。`,
    );

  return {
    query: input.query,
    availableCities: input.availableCities,
    metrics: {
      applications: metric(
        current.applications,
        previous?.applications ?? null,
        "percent",
      ),
      interviewRate: metric(
        current.interviewRate,
        previous?.interviewRate ?? null,
        "percentage_point",
      ),
      offerRate: metric(
        current.offerRate,
        previous?.offerRate ?? null,
        "percentage_point",
      ),
      medianDaysToFirstInterview: metric(
        current.medianDaysToFirstInterview,
        previous?.medianDaysToFirstInterview ?? null,
        "percent",
      ),
      reviewCompletionRate: metric(
        current.reviewCompletionRate,
        previous?.reviewCompletionRate ?? null,
        "percentage_point",
      ),
    },
    trend: buildTrend(applications, input.query.granularity),
    milestones,
    biggestDrop,
    stageReach: RECRUITMENT_STAGES.map((stage) => {
      const count = applications.filter((item) =>
        item.stages.includes(stage),
      ).length;
      return { stage, count, rate: rounded(rate(count, applications.length)) };
    }),
    typeBreakdown,
    cityBreakdown: cities,
    interviews: {
      total: reviews.length,
      completed: reviews.filter((item) => item.status === "completed").length,
      completionRate: rounded(current.reviewCompletionRate ?? 0),
      resolved: resolved.length,
      passed,
      passRate: rounded(rate(passed, resolved.length)),
      byStage,
    },
    summary,
    dataQuality,
    sampleSufficient,
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
