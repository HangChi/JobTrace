import { describe, expect, it } from "vitest";
import {
  INTERVIEW_STAGES,
  isInterviewStage,
} from "@/modules/interviews/domain/catalog";
import {
  canCompleteReview,
  validateCompletion,
} from "@/modules/interviews/domain/interview";
import {
  createInterviewSchema,
  updateInterviewSchema,
} from "@/modules/interviews/domain/interview.schema";

describe("interview review domain", () => {
  it("only permits interview stages", () => {
    expect(INTERVIEW_STAGES).toHaveLength(5);
    expect(isInterviewStage("interview_1")).toBe(true);
    expect(isInterviewStage("written_test")).toBe(false);
  });

  it("requires exactly one stage association mode", () => {
    expect(
      createInterviewSchema.safeParse({ applicationId: crypto.randomUUID() })
        .success,
    ).toBe(false);
    expect(
      createInterviewSchema.safeParse({
        applicationId: crypto.randomUUID(),
        stage: "interview_1",
        interviewedOn: "2026-08-18",
      }).success,
    ).toBe(true);
  });

  it("requires non-empty Markdown content before completion", () => {
    const draft = updateInterviewSchema.parse({ version: 1 });
    expect(canCompleteReview(draft)).toBe(false);
    expect(validateCompletion({ ...draft, status: "completed" })).toBe(false);
    const complete = updateInterviewSchema.parse({
      version: 1,
      status: "completed",
      questions: [{ question: "# 项目复盘\n\n使用 STAR 结构" }],
    });
    expect(canCompleteReview(complete)).toBe(true);
  });

  it("validates duration, rating and text boundaries", () => {
    expect(
      updateInterviewSchema.safeParse({ version: 1, durationMinutes: 0 })
        .success,
    ).toBe(false);
    expect(
      updateInterviewSchema.safeParse({
        version: 1,
        questions: [{ question: "Q", selfRating: 6 }],
      }).success,
    ).toBe(false);
  });
});
