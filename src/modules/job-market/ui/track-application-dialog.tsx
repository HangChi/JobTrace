"use client";

import { useState } from "react";
import { ApplicationForm } from "@/modules/applications/ui/application-form";
import { Dialog } from "@/shared/ui/dialog";

export function TrackApplicationDialog({
  companyName,
  officialUrl,
  status,
}: {
  companyName: string;
  officialUrl: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button secondary button-small"
        disabled={status === "closed"}
        onClick={() => setOpen(true)}
      >
        记录投递
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        kicker="我的投递"
        title="记录投递"
        description="公司和官网已自动填写，可将职位链接替换为实际投递链接。"
        className="application-dialog"
      >
        {open && (
          <ApplicationForm
            embedded
            defaults={{
              companyName,
              positionName: "",
              city: null,
              jobUrl: officialUrl,
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
}
