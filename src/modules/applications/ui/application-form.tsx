"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationDetail } from "../application/contracts";
import {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "../domain/catalog";
import { FormField, TextAreaField } from "@/shared/ui/form-field";
import { Feedback } from "@/shared/ui/feedback";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

export function ApplicationForm({
  application,
  defaults,
  onSuccess,
  onCancel,
  embedded = false,
}: {
  application?: ApplicationDetail;
  defaults?: {
    jobMarketPostId?: string;
    companyName: string;
    positionName?: string;
    city?: string | null;
    jobUrl: string | null;
  };
  onSuccess?: (application: ApplicationDetail) => void;
  onCancel?: () => void;
  embedded?: boolean;
} = {}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(
        application
          ? `/api/applications/${application.id}`
          : "/api/applications",
        {
          method: application ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            application
              ? {
                  ...values,
                  stages: [],
                  version: application.version,
                  changeDate: today(),
                }
              : values,
          ),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      if (onSuccess) {
        onSuccess(result as ApplicationDetail);
      } else {
        router.push(`/applications/${result.id}`);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "保存失败");
      setBusy(false);
    }
  }
  return (
    <form
      className={`${embedded ? "" : "panel "}application-record-form`}
      onSubmit={submit}
    >
      {error && <Feedback kind="error">{error}</Feedback>}
      {defaults?.jobMarketPostId && (
        <input
          type="hidden"
          name="jobMarketPostId"
          value={defaults.jobMarketPostId}
        />
      )}
      <div className="application-form-grid">
        <FormField
          fieldClassName="application-field-half"
          label="公司名称 *"
          name="companyName"
          required
          maxLength={200}
          defaultValue={application?.companyName ?? defaults?.companyName}
          placeholder="例如：字节跳动"
          autoFocus={embedded && !defaults?.companyName}
        />
        <FormField
          fieldClassName="application-field-half"
          label="岗位名称 *"
          name="positionName"
          required
          maxLength={200}
          defaultValue={application?.positionName ?? defaults?.positionName}
          placeholder="例如：前端开发工程师"
          autoFocus={
            embedded && Boolean(defaults?.companyName) && !defaults?.positionName
          }
        />
        <FormField
          fieldClassName="application-field-third"
          label="投递日期 *"
          name="appliedDate"
          type="date"
          required
          defaultValue={application?.appliedDate ?? today()}
        />
        <label className="application-field-third">
          类型
          <span className="select-wrap">
            <select
              name="type"
              defaultValue={application?.type ?? "campus_recruitment"}
            >
              {APPLICATION_TYPES.map((type) => (
                <option value={type} key={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
            </svg>
          </span>
        </label>
        <FormField
          fieldClassName="application-field-third"
          label="城市"
          name="city"
          maxLength={100}
          defaultValue={application?.city ?? defaults?.city ?? ""}
          placeholder="例如：上海"
        />
        <FormField
          fieldClassName="application-field-link"
          label="职位链接"
          name="jobUrl"
          type="url"
          placeholder="https://"
          defaultValue={application?.jobUrl ?? defaults?.jobUrl ?? ""}
        />
        <label className="application-field-status">
          当前状态
          <span className="select-wrap">
            <select
              name="status"
              defaultValue={application?.status ?? "submitted"}
            >
              {APPLICATION_STATUSES.map((v) => (
                <option value={v} key={v}>
                  {STATUS_LABELS[v]}
                </option>
              ))}
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
            </svg>
          </span>
        </label>
        <TextAreaField
          fieldClassName="application-field-full"
          label="备注"
          name="notes"
          rows={2}
          maxLength={10000}
          defaultValue={application?.notes ?? ""}
          placeholder="记录联系人、面试准备或下一步安排……"
        />
      </div>
      <div className="application-form-actions">
        {onCancel && (
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            取消
          </button>
        )}
        <button className="button" disabled={busy}>
          {busy ? "正在保存…" : application ? "保存修改" : "保存投递"}
        </button>
      </div>
    </form>
  );
}
