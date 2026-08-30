"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EditIcon } from "@/shared/ui/action-icons";
import type { Route } from "next";
import { Dialog } from "@/shared/ui/dialog";
import type {
  ApplicationDetail,
  ApplicationDialogData,
  ApplicationSummary,
} from "../application/contracts";
import { STATUS_LABELS, TYPE_LABELS } from "../domain/catalog";
import { formatCompanyWithCity } from "../application/display";
import { EditApplicationDialog } from "./application-dialogs";
import { RecruitmentStageTimeline } from "./recruitment-stage-timeline";
import type { StageInterviewSummary } from "@/modules/interviews/application/contracts";

const DETAIL_CACHE_TTL_MS = 5 * 60_000;
const DETAIL_CACHE_LIMIT = 50;
const detailCache = new Map<
  string,
  { value: ApplicationDialogData; cachedAt: number }
>();

function cacheKey(application: Pick<ApplicationSummary, "id" | "version">) {
  return `${application.id}:${application.version}`;
}

function readCachedDetail(application: ApplicationSummary) {
  const key = cacheKey(application);
  const cached = detailCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > DETAIL_CACHE_TTL_MS) {
    detailCache.delete(key);
    return null;
  }
  detailCache.delete(key);
  detailCache.set(key, cached);
  return cached.value;
}

function writeCachedDetail(value: ApplicationDialogData) {
  const key = cacheKey(value.application);
  detailCache.delete(key);
  detailCache.set(key, { value, cachedAt: Date.now() });
  while (detailCache.size > DETAIL_CACHE_LIMIT) {
    const oldest = detailCache.keys().next().value;
    if (!oldest) break;
    detailCache.delete(oldest);
  }
}

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
          key={cacheKey(application)}
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
  const cached = readCachedDetail(application);
  const [detail, setDetail] = useState<ApplicationDetail | null>(
    cached?.application ?? null,
  );
  const [interviews, setInterviews] = useState<StageInterviewSummary[]>(
    cached?.interviews ?? [],
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cached) return;
    const controller = new AbortController();
    void fetch(`/api/applications/${application.id}/detail`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("暂时无法加载详情");
        const result = (await response.json()) as ApplicationDialogData;
        writeCachedDetail(result);
        setDetail(result.application);
        setInterviews(result.interviews);
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
  }, [application.id, cached]);

  const current = detail ?? application;
  const companyDisplayName = formatCompanyWithCity(
    current.companyName,
    current.city,
  );
  return (
    <>
      <Dialog
        open
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
                  writeCachedDetail({ application: updated, interviews });
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
