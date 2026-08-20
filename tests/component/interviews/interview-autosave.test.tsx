import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInterviewAutosave } from "@/modules/interviews/ui/interview-autosave";

function Harness({ revision = 1 }: { revision?: number }) {
  const autosave = useInterviewAutosave({
    id: "11111111-1111-4111-8111-111111111111",
    revision,
    payload: { version: 1, questions: [], actionItems: [] },
    onSaved: vi.fn(),
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
});
