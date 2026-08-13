import type { ApplicationSummary } from "@/modules/applications";
export type AnalyticsSummary = {
  total: number;
  active: number;
  rejected: number;
  offers: number;
  addedThisWeek: number;
  stageDistribution: Record<string, number>;
  followUps: ApplicationSummary[];
};
