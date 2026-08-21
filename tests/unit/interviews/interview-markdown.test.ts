import { describe, expect, it } from "vitest";
import type { InterviewDetail } from "@/modules/interviews/application/contracts";
import { interviewToMarkdown } from "@/modules/interviews/application/interview-markdown";

const review: InterviewDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  applicationId: "22222222-2222-4222-8222-222222222222",
  stageOccurrenceId: null,
  companyName: "测试科技",
  positionName: "前端工程师",
  stage: "interview_1",
  interviewedOn: "2026-08-18",
  status: "completed",
  roundResult: "passed",
  linked: false,
  questionCount: 1,
  actionCount: 0,
  format: "online",
  durationMinutes: 45,
  interviewerNotes: null,
  highlights: null,
  gaps: null,
  version: 1,
  questions: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      category: "other",
      question: "# 原始 Markdown\n\n内容",
      originalAnswer: null,
      followUpNotes: null,
      improvedAnswer: null,
      selfRating: null,
    },
  ],
  actionItems: [],
  createdAt: "2026-08-18T00:00:00Z",
  updatedAt: "2026-08-18T00:00:00Z",
};

describe("面经 Markdown", () => {
  it("原样导出编辑器中的单篇 Markdown", () => {
    expect(interviewToMarkdown(review)).toBe("# 原始 Markdown\n\n内容");
  });

  it("将结构化问题、回答和行动项组成 Markdown", () => {
    expect(
      interviewToMarkdown({
        ...review,
        highlights: "表达清楚",
        questions: [
          {
            ...review.questions[0],
            question: "缓存穿透是什么？",
            originalAnswer: "空值缓存",
            improvedAnswer: "布隆过滤器与限流",
            selfRating: 4,
          },
        ],
        actionItems: [{ id: "action-1", content: "补充案例", completed: true }],
      }),
    ).toContain("### 复盘后的回答\n\n布隆过滤器与限流");
  });
});
