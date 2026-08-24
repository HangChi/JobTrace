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
            username: "user",
            internalEmail: "user@example.com",
            role: "user",
            disabled: false,
            accessVersion: 1,
            createdAt: "2026-08-13T00:00:00Z",
            lastSignInAt: null,
            applicationCount: 0,
            interviewCount: 0,
          },
        ]}
      />,
    );
    expect(screen.getByText("普通用户")).toBeInTheDocument();
    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看详情" })).toBeVisible();
  });
});
