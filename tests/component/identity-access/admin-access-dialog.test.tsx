import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AdminAccessDialog } from "@/modules/identity-access/ui/admin-access-dialog";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const user = {
  id: "user-1",
  username: "target-user",
  internalEmail: "target@example.test",
  role: "user" as const,
  disabled: false,
  accessVersion: 4,
  createdAt: "2026-08-01T00:00:00.000Z",
  lastSignInAt: null,
  applicationCount: 0,
  interviewCount: 0,
};

describe("admin access dialog", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.unstubAllGlobals();
  });

  test("validates reason and submits a named versioned action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ replayed: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminAccessDialog user={user} actorId="admin-1" />);
    fireEvent.click(screen.getByRole("button", { name: "禁用账号" }));
    const submit = screen.getByRole("button", { name: "确认操作" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("操作原因（10–500 字）"), {
      target: { value: "根据账号安全政策执行临时禁用操作。" },
    });
    fireEvent.click(submit);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      expectedVersion: 4,
      action: "disable_user",
      confirmSelf: false,
      reason: "根据账号安全政策执行临时禁用操作。",
    });
    expect(JSON.parse(options.body).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("requires strengthened confirmation for self-disable", () => {
    render(
      <AdminAccessDialog user={{ ...user, id: "admin-1" }} actorId="admin-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "禁用账号" }));
    fireEvent.change(screen.getByLabelText("操作原因（10–500 字）"), {
      target: { value: "管理员确认结束自己的当前管理会话。" },
    });
    expect(screen.getByRole("button", { name: "确认操作" })).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText("我了解此操作会立即结束当前管理会话"),
    );
    expect(screen.getByRole("button", { name: "确认操作" })).toBeEnabled();
  });

  test("keeps the reason visible and reports a conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: "账号状态已变化，请刷新后重新确认。" }),
      }),
    );
    render(<AdminAccessDialog user={user} actorId="admin-1" />);
    fireEvent.click(screen.getByRole("button", { name: "提升为管理员" }));
    const reason = screen.getByLabelText("操作原因（10–500 字）");
    fireEvent.change(reason, {
      target: { value: "根据审批记录提升该账号成为管理员。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "账号状态已变化",
    );
    expect(reason).toHaveValue("根据审批记录提升该账号成为管理员。");
  });
});
