import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DimensionComparison } from "@/modules/analytics/ui/dimension-comparison";
import { ApplicationTrendChart } from "@/modules/analytics/ui/application-trend-chart";

describe("求职分析图表", () => {
  it("趋势图提供可访问摘要和数据表", () => {
    render(
      <ApplicationTrendChart
        points={[
          {
            periodStart: "2026-08-03",
            label: "08/03",
            applications: 3,
            interviewed: 2,
            offers: 1,
          },
          {
            periodStart: "2026-08-10",
            label: "08/10",
            applications: 4,
            interviewed: 1,
            offers: 0,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("img", { name: /投递、获得面试和获得 Offer/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("查看趋势数据表"));
    expect(screen.getByRole("table")).toHaveTextContent("08/10");
  });

  it("维度切换和排序保持表格语义", () => {
    render(
      <DimensionComparison
        types={[
          {
            key: "campus",
            label: "秋招",
            applications: 8,
            interviewRate: 50,
            offerRate: 12.5,
            sampleSufficient: true,
          },
        ]}
        cities={[
          {
            key: "上海",
            label: "上海",
            applications: 3,
            interviewRate: 66.7,
            offerRate: 0,
            sampleSufficient: false,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "城市" }));
    expect(screen.getByRole("table")).toHaveTextContent("上海");
    expect(screen.getByText("样本较少")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Offer 率/ }));
    expect(
      screen.getByRole("columnheader", { name: /Offer 率/ }),
    ).toHaveAttribute("aria-sort", "descending");
  });
});
