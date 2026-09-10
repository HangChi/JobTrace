import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationFilters } from "@/modules/applications/ui/application-filters";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("application filters", () => {
  beforeEach(() => push.mockClear());

  it("keeps the apply and clear controls in one action group", () => {
    render(<ApplicationFilters query={{}} />);

    const apply = screen.getByRole("button", { name: "应用条件" });
    const clear = screen.getByRole("button", { name: "清空" });

    expect(apply.parentElement).toBe(clear.parentElement);
    expect(apply.parentElement).toHaveClass("application-filter-actions");
    expect(
      screen.queryByRole("combobox", { name: "方向" }),
    ).not.toBeInTheDocument();
  });

  it("starts a newly selected field ascending", () => {
    render(<ApplicationFilters query={{}} />);

    fireEvent.change(screen.getByRole("combobox", { name: "排序" }), {
      target: { value: "latestDate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用条件" }));

    expect(push).toHaveBeenCalledWith(
      "/applications?limit=10&sort=latestDate&direction=asc",
      { scroll: false },
    );
  });

  it("toggles the same field from ascending to descending", () => {
    render(
      <ApplicationFilters query={{ sort: "latestDate", direction: "asc" }} />,
    );

    expect(screen.getByRole("option", { name: "最新日期 ↑" })).toHaveProperty(
      "selected",
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "应用条件" }));

    expect(push).toHaveBeenCalledWith(
      "/applications?limit=10&sort=latestDate&direction=desc",
      { scroll: false },
    );
  });
});
