"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ApplicationSummary,
  ApplicationStatusUpdate,
} from "../application/contracts";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
} from "../domain/catalog";

export function ApplicationStatusSelect({
  application,
  onUpdate,
}: {
  application: ApplicationSummary;
  onUpdate: (application: ApplicationSummary) => void;
}) {
  const [status, setStatus] = useState(application.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 164;
    const menuHeight = menuRef.current?.offsetHeight ?? 142;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - menuWidth / 2),
      window.innerWidth - menuWidth - 12,
    );
    const top =
      rect.bottom + 8 + menuHeight <= window.innerHeight
        ? rect.bottom + 8
        : Math.max(12, rect.top - menuHeight - 8);
    setMenuPosition({ left, top });
  }, []);

  useEffect(() => {
    if (!open) return;

    positionMenu();
    const closeWhenOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeWithEscape);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeWithEscape);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, positionMenu]);

  async function updateStatus(nextStatus: ApplicationStatus) {
    if (nextStatus === status) return;
    const previousStatus = status;
    setStatus(nextStatus);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/applications/${application.id}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            version: application.version,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "状态更新失败，请稍后重试。");
      }
      const updated = result as ApplicationStatusUpdate;
      const summary: ApplicationSummary = {
        ...application,
        ...updated,
        needsFollowUp: false,
        followUpDays: 0,
        followUpReason: null,
      };
      setStatus(summary.status);
      onUpdate(summary);
    } catch (reason) {
      setStatus(previousStatus);
      setError(
        reason instanceof Error ? reason.message : "状态更新失败，请稍后重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="status-select-cell">
      <button
        ref={triggerRef}
        type="button"
        className={`status-menu-trigger status-${status}`}
        aria-label={`${application.companyName} 投递状态，当前${STATUS_LABELS[status]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={saving}
        onClick={(event) => {
          event.stopPropagation();
          if (!open) positionMenu();
          setOpen((current) => !current);
        }}
      >
        <span className="status-menu-trigger-dot" aria-hidden="true" />
        <span>{STATUS_LABELS[status]}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="status-menu-popover"
            role="listbox"
            aria-label={`${application.companyName} 投递状态`}
            style={menuPosition}
            onClick={(event) => event.stopPropagation()}
          >
            {APPLICATION_STATUSES.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option === status}
                className={`status-menu-option status-menu-option-${option}`}
                key={option}
                onClick={() => {
                  setOpen(false);
                  void updateStatus(option);
                }}
              >
                <span className="status-menu-option-dot" aria-hidden="true" />
                <span>{STATUS_LABELS[option]}</span>
                {option === status && (
                  <svg
                    className="status-menu-check"
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                  >
                    <path d="m3.5 8.25 2.8 2.8 6.2-6.2" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
      {saving && <span className="status-save-note">保存中…</span>}
      {error && (
        <span className="status-save-error" role="alert" title={error}>
          更新失败
        </span>
      )}
    </div>
  );
}
