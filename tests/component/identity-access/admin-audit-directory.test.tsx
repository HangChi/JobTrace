import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AdminAuditFilters } from "@/modules/identity-access/ui/admin-audit-filters";
import { AdminAuditTable } from "@/modules/identity-access/ui/admin-audit-table";

describe("admin audit directory", () => {
  test("restores filters and remains read-only", () => {
    render(
      <AdminAuditFilters
        query={{
          actor: "admin",
          target: "deleted-user",
          eventType: "disable_user",
          outcome: "denied",
          occurredFrom: "2026-08-01",
          occurredTo: "2026-08-24",
          page: 1,
          limit: 50,
        }}
      />,
    );
    expect(screen.getByLabelText("操作者")).toHaveValue("admin");
    expect(screen.getByLabelText("目标用户")).toHaveValue("deleted-user");
    expect(screen.getByLabelText("操作类型")).toHaveValue("disable_user");
    expect(
      screen.queryByRole("button", { name: /删除|编辑|导出/ }),
    ).not.toBeInTheDocument();
  });

  test("shows snapshots, before/after state, reason and deleted identity", () => {
    render(
      <AdminAuditTable
        events={[
          {
            id: "event-1",
            requestId: "request-1",
            actorId: "admin-1",
            actorIdentifier: "admin@example.test",
            actorDeleted: false,
            targetUserId: null,
            targetIdentifier: "deleted@example.test",
            targetDeleted: true,
            eventType: "disable_user",
            outcome: "denied",
            reason: "最后管理员保护阻止了本次访问变更。",
            before: { role: "admin", disabled: false, accessVersion: 3 },
            after: null,
            failureCode: "last_admin",
            createdAt: "2026-08-24T01:00:00.000Z",
          },
        ]}
      />,
    );
    expect(
      screen.getByText("deleted@example.test（账号已删除）"),
    ).toBeVisible();
    expect(screen.getByText(/admin\/正常/)).toBeVisible();
    expect(
      screen.getByText("最后管理员保护阻止了本次访问变更。"),
    ).toBeVisible();
    expect(screen.getByText("已拒绝")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
