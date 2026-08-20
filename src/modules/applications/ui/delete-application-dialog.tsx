"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/shared/ui/dialog";

export function DeleteApplicationDialog({
  id,
  name,
  compact = false,
}: {
  id: string;
  name: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function remove() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("删除失败，请稍后重试。");
      setOpen(false);
      if (compact) router.refresh();
      else router.replace("/");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "删除失败，请稍后重试。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className={
          compact ? "table-action table-action-danger" : "button danger"
        }
        onClick={() => setOpen(true)}
      >
        {compact ? "删除" : "删除记录"}
      </button>
      <Dialog
        open={open}
        title="删除这条投递？"
        description="删除后无法恢复，请确认记录是否正确。"
        className="delete-dialog"
        onClose={() => setOpen(false)}
      >
        <div className="delete-warning">
          <span className="delete-warning-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>{name}</strong>
            <p>相关招聘阶段、更新历史和面经复盘也会一起删除。</p>
          </div>
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="delete-dialog-actions">
          <button
            className="button secondary"
            disabled={loading}
            onClick={() => setOpen(false)}
          >
            取消
          </button>
          <button className="button danger" disabled={loading} onClick={remove}>
            {loading ? "正在删除…" : "确认删除"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
