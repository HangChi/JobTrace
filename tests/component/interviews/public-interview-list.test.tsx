import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicInterviewList } from "@/modules/interviews/ui/public-interview-list";

describe("面经广场动态流", () => {
  it("在动态卡片中展示作者、首个问题预览和完整面经入口", () => {
    render(
      <PublicInterviewList
        page={{
          total: 1,
          limit: 20,
          nextCursor: null,
          facets: { cities: ["上海"], positions: ["前端工程师"] },
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              companyName: "轨迹科技",
              positionName: "前端工程师",
              city: "上海",
              stage: "interview_1",
              interviewedOn: "2026-09-10",
              publishedAt: "2026-09-13T08:00:00.000Z",
              questionCount: 2,
              author: null,
              engagement: {
                likeCount: 3,
                commentCount: 1,
                viewCount: 12,
                likedByViewer: false,
              },
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
                {
                  category: "behavioral",
                  question: "不会在动态中直接展开的第二个问题",
                  originalAnswer: null,
                  followUpNotes: null,
                  improvedAnswer: null,
                },
              ],
              recentComments: [],
            },
          ],
        }}
        nextHref={null}
      />,
    );

    const article = screen.getByRole("article");
    expect(screen.getByRole("heading", { name: "最新面经" })).toBeVisible();
    expect(screen.getByText("共 1 篇")).toBeVisible();
    expect(article).toHaveTextContent("匿名用户");
    expect(article).toHaveTextContent("轨迹科技 · 前端工程师");
    expect(article).toHaveTextContent("2026年9月13日");
    expect(article).toHaveTextContent("使用布隆过滤器和空值缓存");
    expect(article).toHaveTextContent("补充限流和监控");
    expect(article).toHaveTextContent("12");
    expect(article).not.toHaveTextContent("不会在动态中直接展开的第二个问题");
    expect(article).not.toHaveTextContent("表达清晰");
    expect(screen.getByRole("link", { name: /轨迹科技/ })).toHaveAttribute(
      "href",
      "/interviews/shared/11111111-1111-4111-8111-111111111111",
    );
    expect(
      screen.getByRole("link", { name: "查看全部 2 个问题" }),
    ).toHaveAttribute(
      "href",
      "/interviews/shared/11111111-1111-4111-8111-111111111111",
    );
  });
});
