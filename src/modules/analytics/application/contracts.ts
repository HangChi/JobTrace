import type { ApplicationSummary } from "@/modules/applications";
import type { RecruitmentStage } from "@/modules/applications/domain/catalog";
export type AnalyticsSummary = {
  total: number;
  submitted: number;
  refused: number;
  offers: number;
  addedThisWeek: number;
  stageDistribution: Partial<Record<RecruitmentStage, number>>;
  followUps: ApplicationSummary[];
};
