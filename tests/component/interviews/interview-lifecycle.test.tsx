import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { InterviewEditor } from "@/modules/interviews/ui/interview-editor";
import type { InterviewDetail } from "@/modules/interviews";

vi.mock("@/modules/interviews/ui/interview-autosave", () => ({
  useInterviewAutosave: () => ({
    state: "idle",
    message: "",
    retry: vi.fn(),
    flush: vi.fn(),
  }),
}));

it("阶段解除关联后仍展示快照并可返回原投递", () => {
  const initial: InterviewDetail = {
    id: "11111111-1111-4111-8111-111111111111",
    applicationId: "22222222-2222-4222-8222-222222222222",
    companyName: "隐私科技",
    positionName: "工程师",
    stage: "interview_2",
    interviewedOn: "2026-08-18",
    status: "pending_review",
    roundResult: "pending",
    linked: false,
    questionCount: 1,
    actionCount: 0,
    stageOccurrenceId: null,
    format: null,
    durationMinutes: null,
    interviewerNotes: null,
    highlights: null,
    gaps: "需要改进",
    version: 2,
    questions: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        category: "other",
        question: "为什么离职？",
        originalAnswer: null,
        followUpNotes: null,
        improvedAnswer: null,
        selfRating: null,
      },
    ],
    actionItems: [],
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  };
  render(<InterviewEditor initial={initial} />);
  expect(screen.getByText("阶段已解除关联")).toBeVisible();
  expect(screen.getByText(/2026-08-18 · 二面/)).toBeVisible();
  expect(screen.getByRole("link", { name: "查看关联投递" })).toHaveAttribute(
    "href",
    "/applications/22222222-2222-4222-8222-222222222222",
  );
});
