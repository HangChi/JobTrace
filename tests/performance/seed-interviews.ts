import type {
  InterviewActionItem,
  InterviewQuestion,
} from "@/modules/interviews";

export function deterministicInterviews(count = 10_000) {
  return Array.from({ length: count }, (_, index) => ({
    companyName: `面经公司 ${index % 500}`,
    positionName: `岗位 ${index % 100}`,
    stage: [
      "interview_1",
      "interview_2",
      "interview_3",
      "hr_interview",
      "final_interview",
    ][index % 5],
    interviewedOn: `2026-08-${String((index % 20) + 1).padStart(2, "0")}`,
    status: index % 3 === 0 ? "completed" : "pending_review",
    roundResult: index % 4 === 0 ? "passed" : "pending",
    questions: [
      {
        id: crypto.randomUUID(),
        category: "technical",
        question: `性能问题 ${index}`,
        originalAnswer: `原回答 ${index}`,
        followUpNotes: null,
        improvedAnswer: `改进回答 ${index}`,
        selfRating: 4,
      } satisfies InterviewQuestion,
    ],
    actionItems: [
      {
        id: crypto.randomUUID(),
        content: `行动项 ${index}`,
        completed: index % 2 === 0,
      } satisfies InterviewActionItem,
    ],
  }));
}
