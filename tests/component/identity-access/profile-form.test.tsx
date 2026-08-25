import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/modules/identity-access";
import { PasswordForm } from "@/modules/identity-access/ui/password-form";
import { ProfileForm } from "@/modules/identity-access/ui/profile-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const profile: Profile = {
  id: "user-1",
  email: "trace_user@users.jobtrace.local",
  username: "trace_user",
  displayName: "小迹",
  image: "https://assets.example/avatar.webp",
  recoveryEmail: "user@example.com",
  role: "user",
  disabled: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("ProfileForm", () => {
  it("prefills user-facing identity and hides the technical avatar URL", () => {
    render(<ProfileForm profile={profile} />);
    expect(screen.getByLabelText("昵称")).toHaveValue("小迹");
    expect(screen.getByLabelText("用户名")).toHaveValue("@trace_user");
    expect(screen.queryByLabelText("头像地址")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  });

  it("marks avatar removal as pending and saves the cleared image", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ displayName: "小迹", image: null }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ProfileForm profile={profile} />);

    fireEvent.click(screen.getByRole("button", { name: "移除头像" }));
    expect(screen.getByText("默认头像将在保存资料后生效。")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "保存资料" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      image: "",
    });
    expect(await screen.findByText("个人资料已保存。")).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe("PasswordForm", () => {
  it("shows password values per field and catches mismatched confirmation", () => {
    render(<PasswordForm />);
    const current = screen.getByLabelText("当前密码");
    fireEvent.click(screen.getByRole("button", { name: "显示当前密码" }));
    expect(current).toHaveAttribute("type", "text");

    fireEvent.change(current, { target: { value: "Current-Password" } });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "Next-Password-1" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "Different-Password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新密码" }));
    expect(screen.getByText("两次输入的新密码不一致。")).toBeVisible();
  });

  it("only requires the new password to be 8–16 characters", () => {
    render(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("当前密码"), {
      target: { value: "Current-Password" },
    });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "1234567" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "1234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新密码" }));
    expect(screen.getByText("新密码请输入 8–16 位。")).toBeVisible();
  });

  it("submits a valid password and reports other-session revocation", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "密码已更新，其他设备已退出登录。" }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("当前密码"), {
      target: { value: "Current-Password" },
    });
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "12345678" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新密码" }));

    expect(
      await screen.findByText("密码已更新，其他设备已退出登录。"),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/profile/password",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      newPassword: "12345678",
    });
  });
});
