import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicInterviewFilters } from "@/modules/interviews/ui/public-interview-filters";

describe("面经广场发现工具栏", () => {
  it("显示公司、城市、岗位和排序，并保留当前条件", () => {
    render(
      <PublicInterviewFilters
        query={{ q: "字节跳动", city: "上海", sort: "hot" }}
        facets={{ cities: ["北京", "上海"], positions: ["前端工程师"] }}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "搜索公司" })).toHaveValue(
      "字节跳动",
    );
    expect(screen.getByRole("combobox", { name: "城市" })).toHaveValue("上海");
    expect(screen.getByRole("combobox", { name: "岗位" })).toBeVisible();
    expect(screen.getByRole("link", { name: "按热度" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "最新发布" })).toHaveAttribute(
      "href",
      "/interviews?q=%E5%AD%97%E8%8A%82%E8%B7%B3%E5%8A%A8&city=%E4%B8%8A%E6%B5%B7",
    );
  });
});
