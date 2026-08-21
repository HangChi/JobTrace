"use client";

import { useState } from "react";
import { ExportButton } from "@/modules/data-transfer/ui/export-button";
import { DeleteIcon } from "@/shared/ui/action-icons";
import { Dialog } from "@/shared/ui/dialog";

export function BulkApplicationActions({
  ids,
  onDeleted,
}: {
  ids: string[];
  onDeleted: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function removeSelected() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "批量删除失败，请稍后重试。");
      }
      if (!result.deletedCount) {
        throw new Error("所选记录已不存在，请刷新列表后重试。");
      }
      setOpen(false);
      onDeleted(result.deletedCount);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "批量删除失败，请稍后重试。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ExportButton scope="selected" ids={ids} />
      <button
        type="button"
        className="button danger bulk-delete-trigger"
        onClick={() => setOpen(true)}
      >
        <DeleteIcon />
        <span>删除所选</span>
      </button>
      <Dialog
        open={open}
        title={`删除所选的 ${ids.length} 条投递？`}
        description="这是不可恢复的批量操作，请确认选择范围。"
        className="delete-dialog"
        onClose={() => !loading && setOpen(false)}
      >
        <div className="delete-warning">
          <span className="delete-warning-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>将永久删除 {ids.length} 条投递记录</strong>
            <p>相关招聘阶段、更新历史和面经复盘也会一起删除。</p>
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
            disabled={loading}
            onClick={() => setOpen(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="button danger"
            disabled={loading}
            onClick={() => void removeSelected()}
          >
            {loading ? (
              "正在删除…"
            ) : (
              <>
                <DeleteIcon />
                <span>确认删除 {ids.length} 条</span>
              </>
            )}
          </button>
        </div>
      </Dialog>
    </>
  );
}
