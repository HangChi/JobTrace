import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationForm } from "@/modules/applications/ui/application-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }),
}));

describe("投递表单", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
  });
  it("服务端失败后保留输入并显示反馈", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "请检查输入内容。" }),
      }),
    );
    render(<ApplicationForm />);
    expect(screen.getByLabelText("类型")).toHaveValue("campus_recruitment");
    fireEvent.change(screen.getByLabelText("公司名称 *"), {
      target: { value: "保留公司" },
    });
    fireEvent.change(screen.getByLabelText("岗位名称 *"), {
      target: { value: "开发" },
    });
    fireEvent.change(screen.getByLabelText("投递日期 *"), {
      target: { value: "2026-08-13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存投递" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "请检查输入内容",
    );
    expect(screen.getByLabelText("公司名称 *")).toHaveValue("保留公司");
  });
  it("成功后进入详情", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ id: "abc" }) }),
    );
    render(<ApplicationForm />);
    fireEvent.change(screen.getByLabelText("公司名称 *"), {
      target: { value: "甲" },
    });
    fireEvent.change(screen.getByLabelText("岗位名称 *"), {
      target: { value: "开发" },
    });
    fireEvent.change(screen.getByLabelText("投递日期 *"), {
      target: { value: "2026-08-13" },
    });
    fireEvent.change(screen.getByLabelText("类型"), {
      target: { value: "daily_internship" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存投递" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/applications/abc"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/applications",
      expect.objectContaining({
        body: expect.stringContaining('"type":"daily_internship"'),
      }),
    );
  });
});
