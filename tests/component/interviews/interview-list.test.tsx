import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InterviewList } from "@/modules/interviews/ui/interview-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("面经列表", () => {
  it("显示可操作空状态", () => {
    render(
      <InterviewList
        page={{ items: [], total: 0, limit: 50, nextCursor: null }}
        nextHref={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "还没有面经" })).toBeVisible();
    expect(screen.getByRole("link", { name: "记录面经" })).toHaveAttribute(
      "href",
      "/interviews/new",
    );
  });

  it("删除前显示公司、岗位和轮次，取消不发送请求", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <InterviewList
        page={{
          total: 1,
          limit: 50,
          nextCursor: null,
          items: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              applicationId: "22222222-2222-4222-8222-222222222222",
              stageOccurrenceId: "33333333-3333-4333-8333-333333333333",
              companyName: "闭环科技",
              positionName: "前端工程师",
              stage: "interview_1",
              interviewedOn: "2026-08-18",
              status: "draft",
              roundResult: "pending",
              linked: true,
              questionCount: 1,
              actionCount: 1,
            },
          ],
        }}
        nextHref={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "闭环科技 · 前端工程师 · 一面",
    );
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("支持单篇 Markdown 导出和多选 ZIP 导出", () => {
    const first = {
      id: "11111111-1111-4111-8111-111111111111",
      applicationId: "22222222-2222-4222-8222-222222222222",
      stageOccurrenceId: "33333333-3333-4333-8333-333333333333",
      companyName: "闭环科技",
      positionName: "前端工程师",
      stage: "interview_1" as const,
      interviewedOn: "2026-08-18",
      status: "completed" as const,
      roundResult: "passed" as const,
      linked: true,
      questionCount: 1,
      actionCount: 1,
    };
    const second = {
      ...first,
      id: "44444444-4444-4444-8444-444444444444",
      companyName: "轨迹科技",
      stage: "interview_2" as const,
    };
    render(
      <InterviewList
        page={{
          total: 2,
          limit: 50,
          nextCursor: null,
          items: [first, second],
        }}
        nextHref={null}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "导出 闭环科技 前端工程师 一面/AI面面经 Markdown",
      }),
    ).toHaveAttribute(
      "href",
      "/api/exports/interviews?id=11111111-1111-4111-8111-111111111111",
    );

    fireEvent.click(screen.getByLabelText("选择当前页全部 2 篇面经"));
    expect(
      screen.getByText("2", { selector: ".bulk-selection-count strong" }),
    ).toBeVisible();
    const bulkExport = screen.getByRole("link", { name: "导出 ZIP" });
    expect(bulkExport).toHaveAttribute(
      "href",
      expect.stringContaining(
        "id=11111111-1111-4111-8111-111111111111&id=44444444-4444-4444-8444-444444444444",
      ),
    );
  });
});
