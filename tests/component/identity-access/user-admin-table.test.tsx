import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAdminTable } from "@/modules/identity-access/ui/user-admin-table";
describe("UserAdminTable", () => {
  it("renders role and status with text", () => {
    render(
      <UserAdminTable
        users={[
          {
            id: "1",
            email: "user@example.com",
            role: "user",
            disabled: false,
            createdAt: "2026-08-13T00:00:00Z",
            lastSignInAt: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("普通用户")).toBeInTheDocument();
    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "禁用" })).toBeEnabled();
  });
});
