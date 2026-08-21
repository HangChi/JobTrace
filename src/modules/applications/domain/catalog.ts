export const APPLICATION_STATUSES = ["submitted", "offer", "refused"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_TYPES = [
  "summer_internship",
  "daily_internship",
  "early_campus_recruitment",
  "campus_recruitment",
  "social_recruitment",
] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];
export const RECRUITMENT_STAGES = [
  "screening",
  "assessment",
  "written_test",
  "interview_1",
  "interview_2",
  "interview_3",
  "hr_interview",
  "final_interview",
] as const;
export type RecruitmentStage = (typeof RECRUITMENT_STAGES)[number];
export const FOLLOW_UP_THRESHOLD_DAYS = 15;
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "已投递",
  offer: "Offer",
  refused: "拒绝",
};
export const TYPE_LABELS: Record<ApplicationType, string> = {
  summer_internship: "暑期实习",
  daily_internship: "日常实习",
  early_campus_recruitment: "秋招提前批",
  campus_recruitment: "秋招",
  social_recruitment: "社招",
};
export const STAGE_LABELS: Record<RecruitmentStage, string> = {
  screening: "简历筛选",
  assessment: "测评/AI测评",
  written_test: "笔试",
  interview_1: "一面/AI面",
  interview_2: "二面",
  interview_3: "三面",
  hr_interview: "HR 面",
  final_interview: "终面",
};
