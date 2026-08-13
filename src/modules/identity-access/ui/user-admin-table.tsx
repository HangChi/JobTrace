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
  async function update(
    user: User,
    patch: { role?: string; disabled?: boolean },
  ) {
    setBusy(user.id);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    location.reload();
  }
  return (
    <div className="panel">
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
