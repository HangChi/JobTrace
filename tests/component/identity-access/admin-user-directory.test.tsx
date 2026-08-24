import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AdminUserFilters } from "@/modules/identity-access/ui/admin-user-filters";
import { UserAdminTable } from "@/modules/identity-access/ui/user-admin-table";

const query = {
  q: "ops",
  role: "admin" as const,
  status: "active" as const,
  registeredFrom: "2026-08-01",
  registeredTo: "2026-08-24",
  page: 2,
  limit: 50,
};

describe("admin user directory", () => {
  test("restores URL-driven filters and exposes clear action", () => {
    render(<AdminUserFilters query={query} />);
    expect(screen.getByLabelText("用户名或内部邮箱")).toHaveValue("ops");
    expect(screen.getByLabelText("角色")).toHaveValue("admin");
    expect(screen.getByLabelText("状态")).toHaveValue("active");
    expect(screen.getByRole("link", { name: "清除筛选" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });

  test("renders named fields, never-signed-in state and minimal detail link", () => {
    render(
      <UserAdminTable
        users={[
          {
            id: "user-1",
            username: "ops-user",
            internalEmail: "ops-user@example.test",
            role: "admin",
            disabled: false,
            accessVersion: 2,
            createdAt: "2026-08-01T00:00:00.000Z",
            lastSignInAt: null,
            applicationCount: 3,
            interviewCount: 1,
          },
        ]}
      />,
    );
    expect(screen.getByText("从未登录")).toBeVisible();
    const recordCell = screen
      .getByText("求职记录")
      .closest("table")
      ?.querySelector('td[data-label="求职记录"]');
    expect(recordCell).toHaveTextContent("3 投递");
    expect(recordCell).toHaveTextContent("1 面经");
    expect(
      screen.getByRole("link", { name: "查看详情" }).getAttribute("href"),
    ).toMatch(/^\/admin\/users\/user-1/);
    expect(screen.queryByText(/简历|备注|附件/)).not.toBeInTheDocument();
  });

  test("shows a useful empty state", () => {
    render(<UserAdminTable users={[]} />);
    expect(screen.getByRole("heading", { name: "没有匹配用户" })).toBeVisible();
  });
});
