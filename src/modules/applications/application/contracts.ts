import type { ApplicationStatus, RecruitmentStage } from "../domain/catalog";
export type ApplicationSummary = {
  id: string;
  companyName: string;
  positionName: string;
  city: string | null;
  jobUrl: string | null;
  appliedDate: string;
  status: ApplicationStatus;
  latestDate: string;
  stages: RecruitmentStage[];
  needsFollowUp: boolean;
  followUpDays: number;
  version: number;
};
export type ApplicationDetail = ApplicationSummary & {
  notes: string | null;
  stageOccurrences: {
    id: string;
    stage: RecruitmentStage;
    occurredOn: string;
  }[];
  events: {
    id: string;
    type: string;
    occurredOn: string;
    before: unknown;
    after: unknown;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
};
export type ApplicationPage = {
  items: ApplicationSummary[];
  nextCursor: string | null;
  total: number;
  page: number;
  limit: number;
};
