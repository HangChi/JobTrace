import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewApplicationDialog } from "@/modules/applications/ui/application-dialogs";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh, back: vi.fn() }),
}));

describe("投递弹窗", () => {
  it("在当前页面新增并在成功后关闭弹窗", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "application-2" }),
      }),
    );
    render(<NewApplicationDialog />);

    fireEvent.click(screen.getByRole("button", { name: /新增投递/ }));
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    fireEvent.change(screen.getByLabelText("公司名称 *"), {
      target: { value: "弹窗公司" },
    });
    fireEvent.change(screen.getByLabelText("岗位名称 *"), {
      target: { value: "前端工程师" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存投递" }));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { hidden: true })).not.toHaveAttribute(
        "open",
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });
});
