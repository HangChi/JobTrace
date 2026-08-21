import type { ApplicationSummary } from "@/modules/applications";
import type { ReviewStatus } from "@/modules/interviews/domain/catalog";
import type {
  ApplicationType,
  RecruitmentStage,
} from "@/modules/applications/domain/catalog";
import type {
  InterviewStage,
  RoundResult,
} from "@/modules/interviews/domain/catalog";

export type ProgressReminder = {
  id: string;
  applicationId: string;
  companyName: string;
  positionName: string;
  city: string | null;
  stageOccurrenceId: string;
  stage: RecruitmentStage;
  occurredOn: string;
  reviewId: string | null;
  reviewStatus: ReviewStatus | null;
  completed?: boolean;
};
export type AnalyticsSummary = {
  total: number;
  submitted: number;
  refused: number;
  offers: number;
  addedThisWeek: number;
  stageDistribution: Partial<Record<RecruitmentStage, number>>;
  followUps: ApplicationSummary[];
  progressReminders: ProgressReminder[];
};

export const ANALYTICS_PERIODS = [
  "30d",
  "90d",
  "180d",
  "ytd",
  "all",
  "custom",
] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export type AnalyticsReportQuery = {
  period: AnalyticsPeriod;
  from?: string;
  to?: string;
  type?: ApplicationType;
  city?: string;
  hasCityFilter: boolean;
};

export type AnalyticsResolvedRange = AnalyticsReportQuery & {
  from?: string;
  to?: string;
  comparisonFrom?: string;
  comparisonTo?: string;
  granularity: "week" | "month";
  error?: string;
};

export type MetricComparison = {
  value: number | null;
  previous: number | null;
  delta: number | null;
  deltaKind: "percent" | "percentage_point";
};

export type AnalyticsTrendPoint = {
  periodStart: string;
  label: string;
  applications: number;
  interviewed: number;
  offers: number;
};

export type AnalyticsMilestone = {
  key: "applications" | "interviewed" | "finalInterview" | "pathOffers";
  label: string;
  count: number;
  conversionFromPrevious: number | null;
};

export type AnalyticsDimensionRow = {
  key: string;
  label: string;
  applications: number;
  interviewRate: number;
  offerRate: number;
  sampleSufficient: boolean;
};

export type InterviewStageResult = {
  stage: InterviewStage;
  total: number;
  results: Record<RoundResult, number>;
};

export type AnalyticsReport = {
  query: AnalyticsResolvedRange;
  availableCities: string[];
  metrics: {
    applications: MetricComparison;
    interviewRate: MetricComparison;
    offerRate: MetricComparison;
    medianDaysToFirstInterview: MetricComparison;
    reviewCompletionRate: MetricComparison;
  };
  trend: AnalyticsTrendPoint[];
  milestones: AnalyticsMilestone[];
  biggestDrop?: { from: string; to: string; count: number };
  stageReach: Array<{
    stage: RecruitmentStage;
    count: number;
    rate: number;
  }>;
  typeBreakdown: AnalyticsDimensionRow[];
  cityBreakdown: AnalyticsDimensionRow[];
  interviews: {
    total: number;
    completed: number;
    completionRate: number;
    resolved: number;
    passed: number;
    passRate: number;
    byStage: InterviewStageResult[];
  };
  summary: string[];
  dataQuality: string[];
  sampleSufficient: boolean;
};
