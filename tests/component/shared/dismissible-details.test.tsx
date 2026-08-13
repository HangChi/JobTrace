import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DismissibleDetails } from "@/shared/ui/dismissible-details";

function Menu() {
  return (
    <div>
      <DismissibleDetails>
        <summary>打开菜单</summary>
        <a href="#target">菜单项</a>
      </DismissibleDetails>
      <button type="button">页面其他位置</button>
    </div>
  );
}

describe("DismissibleDetails", () => {
  it("点击菜单外部后收起", () => {
    render(<Menu />);
    const summary = screen.getByText("打开菜单");
    const details = summary.closest("details");

    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");

    fireEvent.pointerDown(screen.getByText("页面其他位置"));
    expect(details).not.toHaveAttribute("open");
  });

  it("按 Escape 或选择菜单项后收起", () => {
    render(<Menu />);
    const summary = screen.getByText("打开菜单");
    const details = summary.closest("details");

    fireEvent.click(summary);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(details).not.toHaveAttribute("open");
    expect(summary).toHaveFocus();

    fireEvent.click(summary);
    fireEvent.click(screen.getByText("菜单项"));
    expect(details).not.toHaveAttribute("open");
  });
});
