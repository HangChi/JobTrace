import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicInterviewList } from "@/modules/interviews/ui/public-interview-list";

describe("面经广场动态流", () => {
  it("在动态卡片中直接展示匿名作者和脱敏正文", () => {
    render(
      <PublicInterviewList
        page={{
          total: 1,
          limit: 20,
          nextCursor: null,
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              companyName: "轨迹科技",
              positionName: "前端工程师",
              stage: "interview_1",
              interviewedOn: "2026-09-10",
              publishedAt: "2026-09-13T08:00:00.000Z",
              questionCount: 1,
              author: null,
              highlights: "表达清晰",
              gaps: null,
              questions: [
                {
                  category: "technical",
                  question: "# 缓存穿透\n\n使用布隆过滤器和空值缓存。",
                  originalAnswer: null,
                  followUpNotes: null,
                  improvedAnswer: "补充限流和监控。",
                },
              ],
            },
          ],
        }}
        nextHref={null}
      />,
    );

    const article = screen.getByRole("article");
    expect(article).toHaveTextContent("匿名用户");
    expect(article).toHaveTextContent("轨迹科技 · 前端工程师");
    expect(article).toHaveTextContent("使用布隆过滤器和空值缓存");
    expect(article).toHaveTextContent("补充限流和监控");
    expect(article).toHaveTextContent("表达清晰");
    expect(screen.getByRole("link", { name: /轨迹科技/ })).toHaveAttribute(
      "href",
      "/interviews/shared/11111111-1111-4111-8111-111111111111",
    );
  });
});
