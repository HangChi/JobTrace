export const INTERVIEW_STAGES = [
  "assessment",
  "interview_1",
  "interview_2",
  "interview_3",
  "hr_interview",
  "final_interview",
] as const;
export type InterviewStage = (typeof INTERVIEW_STAGES)[number];

export const REVIEW_STATUSES = [
  "draft",
  "pending_review",
  "completed",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const ROUND_RESULTS = ["pending", "passed", "failed"] as const;
export type RoundResult = (typeof ROUND_RESULTS)[number];

export const INTERVIEW_FORMATS = ["online", "offline", "phone"] as const;
export type InterviewFormat = (typeof INTERVIEW_FORMATS)[number];

export const QUESTION_CATEGORIES = [
  "technical",
  "project",
  "behavioral",
  "system_design",
  "other",
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "草稿",
  pending_review: "待复盘",
  completed: "已完成",
};
export const ROUND_RESULT_LABELS: Record<RoundResult, string> = {
  pending: "待反馈",
  passed: "通过",
  failed: "未通过",
};
export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  online: "线上",
  offline: "线下",
  phone: "电话",
};
export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  technical: "技术基础",
  project: "项目经历",
  behavioral: "行为面试",
  system_design: "系统设计",
  other: "其他",
};

export function isInterviewStage(value: string): value is InterviewStage {
  return INTERVIEW_STAGES.includes(value as InterviewStage);
}
