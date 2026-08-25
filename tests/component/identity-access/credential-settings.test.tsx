import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CredentialSettings } from "@/modules/identity-access/ui/credential-settings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("CredentialSettings", () => {
  it("keeps account editors collapsed until requested", () => {
    render(<CredentialSettings email="user@example.com" />);

    expect(screen.getByText("user@example.com")).toBeVisible();
    expect(screen.queryByLabelText("新邮箱")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("新密码")).not.toBeInTheDocument();
  });

  it("opens only one account editor at a time", () => {
    render(<CredentialSettings email="user@example.com" />);

    const emailButton = screen.getByRole("button", { name: /管理邮箱/ });
    fireEvent.click(emailButton);
    expect(emailButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("新邮箱")).toBeVisible();

    const passwordButton = screen.getByRole("button", { name: /修改密码/ });
    fireEvent.click(passwordButton);
    expect(passwordButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByLabelText("新邮箱")).not.toBeInTheDocument();
    expect(screen.getByLabelText("新密码")).toBeVisible();
  });
});
