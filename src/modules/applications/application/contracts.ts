import type {
  ApplicationStatus,
  ApplicationType,
  RecruitmentStage,
} from "../domain/catalog";
import type { StageInterviewSummary } from "@/modules/interviews/application/contracts";
export type ApplicationSummary = {
  id: string;
  companyName: string;
  positionName: string;
  city: string | null;
  jobUrl: string | null;
  appliedDate: string;
  type: ApplicationType;
  status: ApplicationStatus;
  latestDate: string;
  stages: RecruitmentStage[];
  needsFollowUp: boolean;
  followUpDays: number;
  followUpReason: "timeline" | "application" | null;
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
export type ApplicationStatusUpdate = Pick<
  ApplicationSummary,
  "id" | "status" | "latestDate" | "version"
>;
export type ApplicationPage = {
  items: ApplicationSummary[];
  nextCursor: string | null;
  total: number;
  page: number;
  limit: number;
};
export type ApplicationDialogData = {
  application: ApplicationDetail;
  interviews: StageInterviewSummary[];
};
