export { formatCompanyWithCity } from "./application/display";

export {
  addApplicationStage,
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  removeApplicationStage,
  updateApplicationStage,
  updateApplication,
} from "./application/application-service";
export {
  createApplicationSchema,
  updateApplicationSchema,
} from "./domain/application.schema";
export {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  RECRUITMENT_STAGES,
  STATUS_LABELS,
  TYPE_LABELS,
  STAGE_LABELS,
} from "./domain/catalog";
export type {
  ApplicationDetail,
  ApplicationPage,
  ApplicationSummary,
} from "./application/contracts";
