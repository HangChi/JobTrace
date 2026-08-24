"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/shared/ui/dialog";
import { Feedback } from "@/shared/ui/feedback";
import type { ManagedUserSummary } from "../application/contracts";
import type { AdminAccessAction } from "../application/admin-query-schema";

const labels: Record<AdminAccessAction, string> = {
  promote_admin: "提升为管理员",
  demote_admin: "降为普通用户",
  disable_user: "禁用账号",
  enable_user: "重新启用",
};

function actionsFor(user: ManagedUserSummary): AdminAccessAction[] {
  if (user.disabled) return ["enable_user"];
  return user.role === "admin"
    ? ["demote_admin", "disable_user"]
    : ["promote_admin", "disable_user"];
}

export function AdminAccessDialog({
  user,
  actorId,
}: {
  user: ManagedUserSummary;
  actorId: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState<AdminAccessAction>();
  const [reason, setReason] = useState("");
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  }>();
  const requestId = useRef(crypto.randomUUID());
  const selfRisk =
    actorId === user.id &&
    (action === "demote_admin" || action === "disable_user");

  function open(next: AdminAccessAction) {
    requestId.current = crypto.randomUUID();
    setAction(next);
    setReason("");
    setConfirmSelf(false);
    setMessage(undefined);
  }

  function close() {
    if (busy) return;
    setAction(undefined);
    setMessage(undefined);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!action) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          expectedVersion: user.accessVersion,
          action,
          reason,
          confirmSelf,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.message ?? "操作未完成，请核对最新状态。");
      setMessage({ kind: "success", text: "账号访问状态已更新。" });
      if (selfRisk) {
        router.push("/login");
        router.refresh();
        return;
      }
      router.refresh();
      setBusy(false);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "结果未知，请使用相同请求安全重试。",
      });
      setBusy(false);
    }
  }

  return (
    <div className="actions">
      {actionsFor(user).map((candidate) => (
        <button
          key={candidate}
          className={`button ${candidate === "disable_user" ? "danger" : "secondary"}`}
          type="button"
          onClick={() => open(candidate)}
        >
          {labels[candidate]}
        </button>
      ))}
      <Dialog
        open={Boolean(action)}
        title={action ? `${labels[action]}？` : "确认账号操作"}
        description={`${user.username} · 当前为${user.role === "admin" ? "管理员" : "普通用户"}${user.disabled ? "，已禁用" : "，正常"}`}
        onClose={close}
      >
        <form className="stack" onSubmit={submit}>
          <p>此操作会变更账号访问权限，并写入不可修改的管理审计记录。</p>
          <label>
            <span>操作原因（10–500 字）</span>
            <textarea
              value={reason}
              minLength={10}
              maxLength={500}
              required
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {selfRisk ? (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmSelf}
                onChange={(event) => setConfirmSelf(event.target.checked)}
              />
              <span>我了解此操作会立即结束当前管理会话</span>
            </label>
          ) : null}
          {message ? (
            <Feedback kind={message.kind}>{message.text}</Feedback>
          ) : null}
          <div className="actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={close}
            >
              取消
            </button>
            <button
              className="button"
              type="submit"
              disabled={
                busy || reason.trim().length < 10 || (selfRisk && !confirmSelf)
              }
            >
              {busy ? "正在处理…" : "确认操作"}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
