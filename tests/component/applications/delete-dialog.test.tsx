import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteApplicationDialog } from "@/modules/applications/ui/delete-application-dialog";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

describe("删除确认", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
  });
  it("取消时不发送删除请求", () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    render(<DeleteApplicationDialog id="1" name="甲公司 开发" />);
    fireEvent.click(screen.getByRole("button", { name: "删除记录" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(request).not.toHaveBeenCalled();
  });
  it("确认成功后返回列表", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<DeleteApplicationDialog id="1" name="甲公司 开发" />);
    fireEvent.click(screen.getByRole("button", { name: "删除记录" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
