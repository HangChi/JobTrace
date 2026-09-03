"use client";

import { useState } from "react";
import { Dialog } from "@/shared/ui/dialog";
import {
  InterviewCreateForm,
  type InterviewApplicationOption,
} from "./interview-create-form";

export function NewInterviewDialog({
  applications,
  applicationId,
  stageOccurrenceId,
  stage,
  interviewedOn,
  buttonClassName = "button",
  label = "新增复盘",
  showAddIcon = true,
}: {
  applications: InterviewApplicationOption[];
  applicationId?: string;
  stageOccurrenceId?: string;
  stage?: string;
  interviewedOn?: string;
  buttonClassName?: string;
  label?: string;
  showAddIcon?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        className={buttonClassName}
        type="button"
        onClick={() => setOpen(true)}
      >
        {showAddIcon && <span aria-hidden="true">＋</span>} {label}
      </button>
      <Dialog
        open={open}
        kicker="NEW INTERVIEW REVIEW"
        title="记录一次面试"
        className="interview-create-dialog"
        onClose={close}
      >
        {open && (
          <InterviewCreateForm
            applications={applications}
            applicationId={applicationId}
            stageOccurrenceId={stageOccurrenceId}
            stage={stage}
            interviewedOn={interviewedOn}
            embedded
            onCancel={close}
          />
        )}
      </Dialog>
    </>
  );
}
