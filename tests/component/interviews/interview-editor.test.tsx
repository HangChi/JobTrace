import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

const initial: InterviewDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  applicationId: "22222222-2222-4222-8222-222222222222",
  companyName: "闭环科技",
  positionName: "工程师",
  stage: "interview_1",
  interviewedOn: "2026-08-18",
  status: "draft",
  roundResult: "pending",
  linked: true,
  questionCount: 0,
  actionCount: 0,
  stageOccurrenceId: "33333333-3333-4333-8333-333333333333",
  format: null,
  durationMinutes: null,
  interviewerNotes: null,
  highlights: null,
  gaps: null,
  version: 1,
  questions: [],
  actionItems: [],
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

describe("面经编辑器", () => {
  it("使用单一 Markdown 文稿编辑并预览面经", () => {
    render(<InterviewEditor initial={initial} />);

    const editor = screen.getByLabelText("编辑 Markdown");
    fireEvent.change(editor, {
      target: {
        value: "# 缓存专题\n\n- 如何避免缓存穿透？\n- 使用布隆过滤器",
      },
    });
    expect((editor as HTMLTextAreaElement).value).toContain("缓存穿透");
    expect(screen.queryByRole("button", { name: "添加问题" })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "预览" }));
    expect(screen.getByRole("heading", { name: "缓存专题" })).toBeVisible();
    expect(screen.getByText("如何避免缓存穿透？")).toBeVisible();
  });

  it("内容为空时给出提示，填写 Markdown 后允许完成", () => {
    render(<InterviewEditor initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "完成复盘" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请先填写面经内容");

    fireEvent.change(screen.getByLabelText("编辑 Markdown"), {
      target: { value: "# 项目复盘\n\n用 STAR 结构重新组织回答。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成复盘" }));
    expect(screen.getByRole("button", { name: "复盘已完成" })).toBeVisible();
  });

  it("把旧的逐题记录和行动项整理到同一 Markdown 文稿", () => {
    render(
      <InterviewEditor
        initial={{
          ...initial,
          highlights: "表达清晰",
          questions: [
            {
              id: crypto.randomUUID(),
              category: "technical",
              question: "什么是缓存穿透？",
              originalAnswer: "布隆过滤器",
              followUpNotes: null,
              improvedAnswer: "补充空值缓存",
              selfRating: 4,
            },
          ],
          actionItems: [
            { id: crypto.randomUUID(), content: "补充案例", completed: false },
          ],
        }}
      />,
    );

    expect(
      (screen.getByLabelText("编辑 Markdown") as HTMLTextAreaElement).value,
    ).toContain("### 当时的回答");
    expect(
      (screen.getByLabelText("编辑 Markdown") as HTMLTextAreaElement).value,
    ).toContain("## 下一步行动");
    expect(screen.queryByRole("button", { name: "添加任务" })).toBeNull();
  });
});
