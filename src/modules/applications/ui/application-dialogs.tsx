"use client";

import { useState } from "react";
import { Dialog } from "@/shared/ui/dialog";
import type { ApplicationDetail } from "../application/contracts";
import { formatCompanyWithCity } from "../application/display";
import { ApplicationForm } from "./application-form";

export function NewApplicationDialog({
  className = "button",
  label = "新增投递",
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  function close() {
    setOpen(false);
  }
  return (
    <>
      <button className={className} type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">＋</span> {label}
      </button>
      <Dialog
        open={open}
        kicker="NEW APPLICATION"
        title="记录一次新投递"
        description="先填最重要的信息，后续进展可以随时补充。"
        className="application-dialog"
        onClose={close}
      >
        {open && (
          <ApplicationForm embedded onCancel={close} onSuccess={close} />
        )}
      </Dialog>
    </>
  );
}

export function EditApplicationDialog({
  application,
  open,
  onClose,
  onSuccess,
}: {
  application: ApplicationDetail | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (application: ApplicationDetail) => void;
}) {
  if (!application) return null;
  return (
    <Dialog
      open={open}
      kicker="EDIT APPLICATION"
      title={`编辑 ${formatCompanyWithCity(application.companyName, application.city)}`}
      description={application.positionName}
      className="application-dialog"
      onClose={onClose}
    >
      <ApplicationForm
        key={`${application.id}-${application.version}`}
        application={application}
        embedded
        onCancel={onClose}
        onSuccess={(updated) => {
          onSuccess?.(updated);
          onClose();
        }}
      />
    </Dialog>
  );
}
