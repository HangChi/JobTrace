import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportUploader } from "@/modules/data-transfer/ui/import-uploader";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

const preview = {
  id: "00000000-0000-4000-8000-000000000001",
  expiresAt: "2026-09-05T00:00:00.000Z",
  totalRows: 1,
  validRows: 0,
  invalidRows: 1,
  duplicateRows: 0,
  columns: { 企业简称: "", 职位名: "", 日期: "" },
  rows: [
    {
      rowNumber: 2,
      data: null,
      errors: [
        { field: "companyName", code: "custom", message: "请输入公司名称" },
      ],
      duplicateApplicationIds: [],
    },
  ],
};

describe("导入列映射", () => {
  it("保留原文件并携带新映射和旧批次重新预检", async () => {
    const remapped = {
      ...preview,
      id: "00000000-0000-4000-8000-000000000002",
      validRows: 1,
      invalidRows: 0,
      columns: {
        企业简称: "companyName",
        职位名: "positionName",
        日期: "appliedDate",
      },
      rows: [
        {
          rowNumber: 2,
          data: {
            companyName: "映射公司",
            positionName: "工程师",
            appliedDate: "2026-08-13",
          },
          errors: [],
          duplicateApplicationIds: [],
        },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preview })
      .mockResolvedValueOnce({ ok: true, json: async () => remapped });
    vi.stubGlobal("fetch", fetch);
    render(<ImportUploader />);

    const file = new File(
      ["企业简称,职位名,日期\n映射公司,工程师,2026-08-13"],
      "custom.csv",
      {
        type: "text/csv",
      },
    );
    fireEvent.change(screen.getByLabelText("选择文件"), {
      target: { files: [file] },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "上传并预检" }).closest("form")!,
    );
    await screen.findByRole("heading", { name: "预检结果" });

    fireEvent.change(screen.getByLabelText("企业简称 映射到"), {
      target: { value: "companyName" },
    });
    fireEvent.change(screen.getByLabelText("职位名 映射到"), {
      target: { value: "positionName" },
    });
    fireEvent.change(screen.getByLabelText("日期 映射到"), {
      target: { value: "appliedDate" },
    });
    expect(screen.getByRole("button", { name: "确认所选行" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "使用新映射重新预检" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const request = fetch.mock.calls[1][1] as RequestInit;
    const body = request.body as FormData;
    expect(body.get("file")).toBeInstanceOf(File);
    expect((body.get("file") as File).name).toBe("custom.csv");
    expect(body.get("replaceBatchId")).toBe(preview.id);
    expect(JSON.parse(String(body.get("mapping")))).toEqual(remapped.columns);
    await screen.findByText("映射公司 · 工程师 · 秋招");
  });
});
