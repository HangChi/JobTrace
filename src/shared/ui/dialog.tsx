"use client";
import { useEffect, useId, useRef } from "react";
export function Dialog({
  open,
  title,
  kicker,
  description,
  className = "",
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  kicker?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
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
      className={className}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="dialog-card">
        <div className="dialog-heading">
          <div>
            {kicker && <p className="section-kicker">{kicker}</p>}
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p className="dialog-description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button
            className="dialog-close"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
