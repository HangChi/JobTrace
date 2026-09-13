import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicInterviewFilters } from "@/modules/interviews/ui/public-interview-filters";

describe("面经广场公司搜索", () => {
  it("只显示公司搜索并保留当前搜索词", () => {
    render(<PublicInterviewFilters query={{ q: "字节跳动" }} />);

    expect(screen.getByRole("searchbox", { name: "公司" })).toHaveValue(
      "字节跳动",
    );
    expect(screen.getByRole("button", { name: "搜索" })).toBeVisible();
    expect(screen.getByRole("link", { name: "清除" })).toHaveAttribute(
      "href",
      "/interviews",
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });
});
