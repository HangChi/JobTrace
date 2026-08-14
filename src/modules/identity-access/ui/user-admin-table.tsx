"use client";
import { useState } from "react";
type User = {
  id: string;
  email: string;
  role: "user" | "admin";
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};
export function UserAdminTable({ users }: { users: User[] }) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  async function update(
    user: User,
    patch: { role?: string; disabled?: boolean },
  ) {
    const action =
      patch.disabled === true
        ? "禁用"
        : patch.disabled === false
          ? "启用"
          : patch.role === "admin"
            ? "设为管理员"
            : "降为普通用户";
    if (!window.confirm(`确认将 ${user.email} ${action}？`)) return;
    setBusy(user.id);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(problem?.detail ?? "操作失败，请稍后重试。");
      }
      location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "操作失败，请稍后重试。",
      );
      setBusy(undefined);
    }
  }
  return (
    <div className="panel">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>用户</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role === "admin" ? "管理员" : "普通用户"}</td>
              <td>{u.disabled ? "已禁用" : "正常"}</td>
              <td>{new Date(u.createdAt).toLocaleDateString("zh-CN")}</td>
              <td className="actions">
                <button
                  className="button secondary"
                  disabled={busy === u.id}
                  onClick={() =>
                    update(u, { role: u.role === "admin" ? "user" : "admin" })
                  }
                >
                  切换角色
                </button>
                <button
                  className="button secondary"
                  disabled={busy === u.id}
                  onClick={() => update(u, { disabled: !u.disabled })}
                >
                  {u.disabled ? "启用" : "禁用"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
