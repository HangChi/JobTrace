import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InterviewDetail } from "@/modules/interviews";
import { useInterviewAutosave } from "@/modules/interviews/ui/interview-autosave";

function Harness({
  revision = 1,
  onSaved = vi.fn(),
}: {
  revision?: number;
  onSaved?: (value: InterviewDetail, context: { isLatest: boolean }) => void;
}) {
  const autosave = useInterviewAutosave({
    id: "11111111-1111-4111-8111-111111111111",
    revision,
    payload: { version: revision, questions: [], actionItems: [] },
    onSaved,
  });
  useEffect(() => {
    window.__testFlush = autosave.flush;
  }, [autosave.flush]);
  return <p>{autosave.message || autosave.state}</p>;
}

declare global {
  interface Window {
    __testFlush?: () => Promise<void>;
  }
}

describe("面经自动保存", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.__testFlush;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("变更后防抖 800ms 保存并展示成功状态", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);

    await act(async () => vi.advanceTimersByTimeAsync(799));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/已保存/)).toBeVisible();
  });

  it("失败可重试，冲突停止覆盖", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "网络暂不可用" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: "版本冲突" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);

    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(screen.getByText("网络暂不可用")).toBeVisible();
    await act(async () => window.__testFlush?.());
    expect(
      screen.getByText("面经已在其他页面更新，请刷新后继续。"),
    ).toBeVisible();
  });

  it("页面隐藏时立即 flush 未保存内容", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("旧请求返回时标记为过期，并继续保存请求期间的新修改", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: object) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: 3 }),
      });
    const onSaved = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<Harness revision={1} onSaved={onSaved} />);

    await act(async () => vi.advanceTimersByTimeAsync(800));
    rerender(<Harness revision={2} onSaved={onSaved} />);
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () => ({ version: 2 }),
      });
      await firstResponse;
    });

    expect(onSaved).toHaveBeenNthCalledWith(
      1,
      { version: 2 },
      { isLatest: false },
    );
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenNthCalledWith(
      2,
      { version: 3 },
      { isLatest: true },
    );
  });

  it("保存进行中离开页面时立即 keepalive 提交最新修订", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: object) => void;
    let resolveSecond!: (value: object) => void;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstResponse)
      .mockReturnValueOnce(secondResponse);
    const onSaved = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<Harness revision={1} onSaved={onSaved} />);

    await act(async () => vi.advanceTimersByTimeAsync(800));
    rerender(<Harness revision={2} onSaved={onSaved} />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstRequest = fetchMock.mock.calls[0][1] as RequestInit;
    const secondRequest = fetchMock.mock.calls[1][1] as RequestInit;
    const firstBody = JSON.parse(String(firstRequest.body));
    const secondBody = JSON.parse(String(secondRequest.body));
    expect(firstRequest.keepalive).toBe(false);
    expect(secondRequest.keepalive).toBe(true);
    expect(firstBody.autosaveSessionId).toBe(secondBody.autosaveSessionId);
    expect(firstBody.autosaveRevision).toBe(1);
    expect(secondBody.autosaveRevision).toBe(2);

    await act(async () => {
      resolveSecond({
        ok: true,
        json: async () => ({ version: 3 }),
      });
      await secondResponse;
      resolveFirst({
        ok: true,
        json: async () => ({ version: 3 }),
      });
      await firstResponse;
    });
    expect(onSaved).toHaveBeenCalledWith({ version: 3 }, { isLatest: true });
  });
});
