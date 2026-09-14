import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicInterviewEngagement } from "@/modules/interviews/ui/public-interview-engagement";

const initial = {
  likeCount: 2,
  commentCount: 0,
  viewCount: 8,
  likedByViewer: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("公开面经互动", () => {
  it("乐观切换点赞并采用服务端计数", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ...initial, likeCount: 3, likedByViewer: true }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(
      <PublicInterviewEngagement
        interviewId="11111111-1111-4111-8111-111111111111"
        initialEngagement={initial}
        initialComments={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /点赞，当前 2 个赞/ }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /取消点赞，当前 3 个赞/ }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/interviews/public/11111111-1111-4111-8111-111111111111/like",
      { method: "POST" },
    );
  });

  it("提交署名评论并清空输入框", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          comment: {
            id: "22222222-2222-4222-8222-222222222222",
            content: "很有帮助",
            createdAt: "2026-09-13T10:00:00Z",
            author: { username: "viewer", image: null },
          },
          engagement: { ...initial, commentCount: 1 },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <PublicInterviewEngagement
        interviewId="11111111-1111-4111-8111-111111111111"
        initialEngagement={initial}
        initialComments={[]}
      />,
    );

    expect(
      screen.queryByRole("textbox", { name: "写下你的评论" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /评论，当前 0 条评论/ }),
    );
    const input = screen.getByRole("textbox", { name: "写下你的评论" });
    fireEvent.change(input, { target: { value: "很有帮助" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(screen.getByText("@viewer")).toBeVisible());
    expect(screen.getByText("很有帮助")).toBeVisible();
    expect(input).toHaveValue("");
  });

  it("就地提示空白评论", () => {
    render(
      <PublicInterviewEngagement
        interviewId="11111111-1111-4111-8111-111111111111"
        initialEngagement={initial}
        initialComments={[]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /评论，当前 0 条评论/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "评论需填写 1 至 1000 个字符。",
    );
  });

  it("在系统分享不可用时复制公开详情链接", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(
      <PublicInterviewEngagement
        interviewId="11111111-1111-4111-8111-111111111111"
        initialEngagement={initial}
        initialComments={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "分享面经" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("面经链接已复制。"),
    );
    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/interviews/shared/11111111-1111-4111-8111-111111111111",
    );
  });
});
