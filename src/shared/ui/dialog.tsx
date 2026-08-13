"use client";
import { useEffect, useRef } from "react";
export function Dialog({
  open,
  title,
  kicker,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-card">
        <div className="dialog-heading">
          <div>
            {kicker && <p className="section-kicker">{kicker}</p>}
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            className="dialog-close"
            onClick={onClose}
            aria-label="关闭详情"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
