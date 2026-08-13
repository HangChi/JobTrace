import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";
describe("AuthForm", () => {
  it("uses accessible credential semantics", () => {
    render(<AuthForm mode="login" action={vi.fn(async () => ({}))} />);
    expect(screen.getByLabelText("用户名")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("密码")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByRole("button", { name: "登录" })).toBeEnabled();
  });
});
