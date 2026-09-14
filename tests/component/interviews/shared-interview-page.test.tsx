import { beforeEach, describe, expect, it, vi } from "vitest";
import { Problem } from "@/shared/errors/problem";

const getPublicInterview = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
});

vi.mock("@/modules/interviews", () => ({ getPublicInterview }));
vi.mock("@/modules/identity-access", () => ({
  requirePageUser: vi.fn().mockResolvedValue({ id: "viewer" }),
}));
vi.mock("next/navigation", () => ({ notFound }));

describe("公开面经详情页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("仅将明确的资源不存在映射为 404", async () => {
    getPublicInterview.mockRejectedValueOnce(
      new Problem("not_found", "没有找到这篇公开面经。", 404),
    );
    const { default: SharedInterviewPage } =
      await import("@/app/(protected)/interviews/shared/[id]/page");

    await expect(
      SharedInterviewPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("让存储或程序错误继续交给错误边界处理", async () => {
    const failure = new Error("database unavailable");
    getPublicInterview.mockRejectedValueOnce(failure);
    const { default: SharedInterviewPage } =
      await import("@/app/(protected)/interviews/shared/[id]/page");

    await expect(
      SharedInterviewPage({ params: Promise.resolve({ id: "broken" }) }),
    ).rejects.toBe(failure);
    expect(notFound).not.toHaveBeenCalled();
  });
});
