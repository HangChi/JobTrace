import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthForm", () => {
  it("uses accessible credential semantics", () => {
    render(
      <AuthForm
        mode="login"
        action={vi.fn(async () => ({}))}
        defaultIdentifier="trace_user"
        returnTo="/analytics"
      />,
    );
    expect(screen.getByLabelText("邮箱或用户名")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("邮箱或用户名")).toHaveValue("trace_user");
    expect(screen.getByLabelText("密码")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(document.querySelector('input[name="returnTo"]')).toHaveValue(
      "/analytics",
    );
    expect(screen.getByRole("button", { name: "登录" })).toBeEnabled();
  });

  it("provides registration guidance and matching password fields", () => {
    render(<AuthForm mode="register" action={vi.fn(async () => ({}))} />);

    expect(screen.getByLabelText("用户名")).toHaveAttribute("maxlength", "30");
    expect(screen.getByText(/3–30 位/)).toBeVisible();
    expect(screen.getByLabelText("昵称")).not.toBeRequired();
    expect(screen.getByLabelText("邮箱")).toBeRequired();
    expect(screen.getByLabelText("邮箱验证码")).toBeRequired();
    expect(screen.getByRole("button", { name: "发送验证码" })).toBeEnabled();
    expect(screen.getByLabelText("密码")).toHaveAttribute("maxlength", "16");
    expect(screen.getByLabelText("确认密码")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );

    fireEvent.click(screen.getAllByRole("button", { name: "显示密码" })[0]);
    expect(screen.getByLabelText("密码")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("确认密码")).toHaveAttribute("type", "text");
  });

  it("shows a duplicate-email error beside the registration email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          code: "email_conflict",
          message: "该邮箱已绑定账号，请更换邮箱或直接登录。",
          fieldErrors: [
            {
              field: "email",
              code: "email_conflict",
              message: "该邮箱已绑定账号，请更换邮箱或直接登录。",
            },
          ],
        }),
      }),
    );
    render(<AuthForm mode="register" action={vi.fn(async () => ({}))} />);

    const email = screen.getByLabelText("邮箱");
    fireEvent.change(email, { target: { value: "used@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(
      await screen.findByText("该邮箱已绑定账号，请更换邮箱或直接登录。"),
    ).toBeVisible();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "email-code-error");
  });

  it("shows a friendly error when the email endpoint returns non-JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      }),
    );
    render(<AuthForm mode="register" action={vi.fn(async () => ({}))} />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(
      await screen.findByText("验证码发送失败，请稍后重试。"),
    ).toBeVisible();
    expect(screen.queryByText(/Unexpected token/)).not.toBeInTheDocument();
  });

  it("focuses the error summary and connects field-level errors", async () => {
    const action = vi.fn(async () => ({
      error: "请检查输入内容。",
      fieldErrors: { confirmPassword: "两次输入的密码不一致" },
    }));
    render(<AuthForm mode="register" action={action} />);

    const form = screen
      .getByRole("button", { name: "创建账号" })
      .closest("form");
    fireEvent.submit(form!);

    const summary = await screen.findByRole("alert");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByLabelText("确认密码")).toHaveAttribute(
      "aria-describedby",
      "confirmPassword-error",
    );
    expect(screen.getByLabelText("确认密码")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByRole("link", { name: "确认密码：两次输入的密码不一致" }),
    ).toHaveAttribute("href", "#confirmPassword");
    expect(screen.getByText("两次输入的密码不一致")).toBeVisible();
  });
});
