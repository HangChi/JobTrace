export const APPLICATION_STATUSES = [
  "planned",
  "active",
  "rejected",
  "offer",
  "accepted",
  "withdrawn",
  "no_response",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
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
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  planned: "计划投递",
  active: "进行中",
  rejected: "未通过",
  offer: "已获 Offer",
  accepted: "已接受",
  withdrawn: "已撤回",
  no_response: "暂无回复",
};
export const STAGE_LABELS: Record<RecruitmentStage, string> = {
  screening: "简历筛选",
  assessment: "测评",
  written_test: "笔试",
  interview_1: "一面",
  interview_2: "二面",
  interview_3: "三面",
  hr_interview: "HR 面",
  final_interview: "终面",
};
