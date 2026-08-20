import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageDistribution } from "@/modules/analytics/ui/stage-distribution";

describe("阶段分布", () => {
  it("按阶段次数绘制动态占比圆环", () => {
    render(<StageDistribution values={{ screening: 15, assessment: 2 }} />);

    const chart = screen.getByLabelText("共 17 次阶段记录");
    expect(chart).toHaveStyle({
      background:
        "radial-gradient(circle at center, white 55%, transparent 57%), conic-gradient(#3182a0 0% 88.23529411764706%, #7a64bd 88.23529411764706% 100%)",
    });
    expect(screen.getByText("15")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });
});
