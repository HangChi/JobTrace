import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReminderEditorDialog } from "@/modules/reminders/ui/reminder-editor-dialog";

describe("ReminderEditorDialog", () => {
  it("shows the actual notification time and email eligibility", () => {
    render(
      <ReminderEditorDialog
        application={{
          id: crypto.randomUUID(),
          companyName: "示例公司",
          positionName: "工程师",
        }}
        email={{ available: true, address: "user@example.com" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "设置提醒" }));
    expect(screen.getByRole("heading", { name: "设置提醒" })).toBeVisible();
    expect(screen.getByText(/user@example.com/)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      /将于.+提醒（北京时间）/,
    );
  });

  it("disables email and links to profile when no verified address exists", () => {
    render(
      <ReminderEditorDialog
        application={{
          id: crypto.randomUUID(),
          companyName: "示例公司",
          positionName: "工程师",
        }}
        email={{ available: false, address: null }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "设置提醒" }));
    expect(screen.getByRole("checkbox", { name: /邮件提醒/ })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "绑定并验证邮箱" }),
    ).toHaveAttribute("href", "/profile");
  });
});
