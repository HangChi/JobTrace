"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/shared/ui/dialog";
export function DeleteApplicationDialog({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function remove() {
    const response = await fetch(`/api/applications/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push("/");
      router.refresh();
    }
  }
  return (
    <>
      <button className="button danger" onClick={() => setOpen(true)}>
        删除记录
      </button>
      <Dialog
        open={open}
        title={`确认删除“${name}”？`}
        onClose={() => setOpen(false)}
      >
        <p>该操作会同时删除阶段和历史，且无法撤销。</p>
        <div className="actions">
          <button className="button danger" onClick={remove}>
            确认删除
          </button>
          <button className="button secondary" onClick={() => setOpen(false)}>
            取消
          </button>
        </div>
      </Dialog>
    </>
  );
}
