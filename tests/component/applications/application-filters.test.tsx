import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationFilters } from "@/modules/applications/ui/application-filters";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("application filters", () => {
  it("keeps the apply and clear controls in one action group", () => {
    render(<ApplicationFilters query={{}} />);

    const apply = screen.getByRole("button", { name: "应用条件" });
    const clear = screen.getByRole("button", { name: "清空" });

    expect(apply.parentElement).toBe(clear.parentElement);
    expect(apply.parentElement).toHaveClass("application-filter-actions");
  });
});
