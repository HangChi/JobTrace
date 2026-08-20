"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EditIcon } from "@/shared/ui/action-icons";
import type { Route } from "next";
import { Dialog } from "@/shared/ui/dialog";
import type {
  ApplicationDetail,
  ApplicationSummary,
} from "../application/contracts";
import { STATUS_LABELS, TYPE_LABELS } from "../domain/catalog";
import { formatCompanyWithCity } from "../application/display";
import { EditApplicationDialog } from "./application-dialogs";
import { RecruitmentStageTimeline } from "./recruitment-stage-timeline";
import type { InterviewPage } from "@/modules/interviews/application/contracts";

export function ApplicationDetailDialog({
  application,
  onClose,
  onUpdate,
}: {
  application: ApplicationSummary | null;
  onClose: () => void;
  onUpdate?: (application: ApplicationDetail) => void;
}) {
  const [editing, setEditing] = useState<ApplicationDetail | null>(null);
  return (
    <>
      {application && (
        <ApplicationDetailContent
          key={application.id}
          application={application}
          onClose={onClose}
          onUpdate={onUpdate}
          onEdit={(detail) => {
            onClose();
            setEditing(detail);
          }}
        />
      )}
      <EditApplicationDialog
        application={editing}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSuccess={onUpdate}
      />
    </>
  );
}

function ApplicationDetailContent({
  application,
  onClose,
  onUpdate,
  onEdit,
}: {
  application: ApplicationSummary;
  onClose: () => void;
  onUpdate?: (application: ApplicationDetail) => void;
  onEdit: (application: ApplicationDetail) => void;
}) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [interviews, setInterviews] = useState<InterviewPage["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch(`/api/applications/${application.id}`, {
        signal: controller.signal,
      }),
      fetch(`/api/interviews?applicationId=${application.id}&limit=100`, {
        signal: controller.signal,
      }),
    ])
      .then(async ([detailResponse, interviewResponse]) => {
        if (!detailResponse.ok || !interviewResponse.ok)
          throw new Error("暂时无法加载详情");
        setDetail((await detailResponse.json()) as ApplicationDetail);
        setInterviews(
          ((await interviewResponse.json()) as InterviewPage).items,
        );
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(reason instanceof Error ? reason.message : "暂时无法加载详情");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [application.id]);

  const current = detail ?? application;
  const companyDisplayName = formatCompanyWithCity(
    current.companyName,
    current.city,
  );
  return (
    <>
      <Dialog
        open
        kicker="APPLICATION DETAIL"
        title={`${companyDisplayName} · ${current.positionName}`}
        className="application-detail-dialog"
        onClose={onClose}
      >
        <div className="detail-dialog-body">
          {current && (
            <div className="detail-meta-grid">
              <div>
                <span>当前状态</span>
                <strong>{STATUS_LABELS[current.status]}</strong>
              </div>
              <div>
                <span>投递日期</span>
                <strong>{current.appliedDate}</strong>
              </div>
              <div>
                <span>类型</span>
                <strong>
                  {TYPE_LABELS[current.type ?? "campus_recruitment"]}
                </strong>
              </div>
              <div>
                <span>工作城市</span>
                <strong>{current.city || "未填写"}</strong>
              </div>
              <div>
                <span>最近更新</span>
                <strong>{current.latestDate}</strong>
              </div>
            </div>
          )}
          {loading && (
            <p className="detail-loading detail-loading-inline">
              正在加载阶段和备注…
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
          {detail && (
            <>
              <RecruitmentStageTimeline
                application={detail}
                interviews={interviews}
                onUpdate={(updated) => {
                  setDetail(updated);
                  onUpdate?.(updated);
                }}
              />
              {detail.notes && (
                <section className="detail-section">
                  <h3>备注</h3>
                  <p className="detail-notes">{detail.notes}</p>
                </section>
              )}
              <div className="detail-dialog-actions">
                {detail.jobUrl && (
                  <a
                    className="button secondary detail-action-link"
                    href={detail.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开投递链接 ↗
                  </a>
                )}
                <Link
                  className="button secondary detail-action-full"
                  href={`/applications/${detail.id}` as Route}
                >
                  查看完整详情
                </Link>
                <button
                  className="button detail-action-edit"
                  type="button"
                  onClick={() => onEdit(detail)}
                >
                  <EditIcon />
                  <span>编辑这条投递</span>
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
