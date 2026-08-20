import { calendarDaysBetween } from "@/shared/date/business-date";
import { FOLLOW_UP_THRESHOLD_DAYS } from "@/modules/applications/domain/catalog";
import type { RecruitmentStage } from "@/modules/applications/domain/catalog";
import type { ReviewStatus } from "@/modules/interviews/domain/catalog";
export function needsFollowUp(
  status: string,
  latestDate: string,
  today: string,
) {
  return (
    status === "submitted" &&
    calendarDaysBetween(latestDate, today) >= FOLLOW_UP_THRESHOLD_DAYS
  );
}
export function followUpReason(
  status: string,
  latestDate: string,
  timelineLatestDate: string | null,
  today: string,
) {
  if (status !== "submitted") return null;
  if (
    timelineLatestDate &&
    calendarDaysBetween(timelineLatestDate, today) >= FOLLOW_UP_THRESHOLD_DAYS
  ) {
    return "timeline" as const;
  }
  if (calendarDaysBetween(latestDate, today) >= FOLLOW_UP_THRESHOLD_DAYS) {
    return "application" as const;
  }
  return null;
}
export function summarizeApplications(items: { status: string }[]) {
  return {
    total: items.length,
    submitted: items.filter((x) => x.status === "submitted").length,
    refused: items.filter((x) => x.status === "refused").length,
    offers: items.filter((x) => x.status === "offer").length,
  };
}

export const PROGRESS_REMINDER_STAGES: RecruitmentStage[] = [
  "assessment",
  "written_test",
  "interview_1",
  "interview_2",
  "interview_3",
  "hr_interview",
  "final_interview",
];

export function needsProgressReminder(
  stage: RecruitmentStage,
  reviewStatus: ReviewStatus | null = null,
) {
  if (!PROGRESS_REMINDER_STAGES.includes(stage)) return false;
  const isInterview =
    stage.startsWith("interview_") ||
    stage === "hr_interview" ||
    stage === "final_interview";
  return !isInterview || reviewStatus !== "completed";
}
