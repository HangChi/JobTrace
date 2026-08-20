import type { ApplicationSummary } from "@/modules/applications";
import type { RecruitmentStage } from "@/modules/applications/domain/catalog";
import type { ReviewStatus } from "@/modules/interviews/domain/catalog";

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
