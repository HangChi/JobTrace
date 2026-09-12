export { formatCompanyWithCity } from "./application/display";

export {
  addApplicationStage,
  createApplication,
  deleteApplication,
  deleteApplications,
  getApplication,
  getApplicationDialogData,
  listApplications,
  removeApplicationStage,
  updateApplicationStage,
  updateApplication,
  updateApplicationStatus,
} from "./application/application-service";
export {
  countApplications,
  listApplicationOptions,
  type ApplicationOption,
} from "./application/application-options";
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
  ApplicationDialogData,
  ApplicationPage,
  ApplicationSummary,
  ApplicationStatusUpdate,
} from "./application/contracts";
