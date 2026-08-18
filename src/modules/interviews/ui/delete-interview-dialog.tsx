"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/shared/ui/dialog";

export function DeleteInterviewDialog({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function remove() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/interviews/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("删除失败，请稍后重试。");
      setBusy(false);
      return;
    }
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <button
        type="button"
        className="table-action table-action-danger"
        onClick={() => setOpen(true)}
      >
        删除
      </button>
      <Dialog
        open={open}
        title="删除这篇面经？"
        description="问题、回答和行动项会一起删除，且无法恢复。"
        onClose={() => setOpen(false)}
      >
        <div className="delete-warning">
          <span className="delete-warning-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>{name}</strong>
            <p>关联的投递和招聘阶段不会被删除。</p>
          </div>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="delete-dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            {busy ? "正在删除…" : "确认删除"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
