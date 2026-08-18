"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { INTERVIEW_STAGES } from "../domain/catalog";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";

type ApplicationOption = { id: string; label: string; appliedDate: string };

export function InterviewCreateForm({
  applications,
  applicationId,
  stageOccurrenceId,
  stage,
  interviewedOn,
}: {
  applications: ApplicationOption[];
  applicationId?: string;
  stageOccurrenceId?: string;
  stage?: string;
  interviewedOn?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      applicationId: values.applicationId,
      ...(stageOccurrenceId
        ? { stageOccurrenceId }
        : { stage: values.stage, interviewedOn: values.interviewedOn }),
      format: values.format || null,
      durationMinutes: values.durationMinutes
        ? Number(values.durationMinutes)
        : null,
      roundResult: "pending",
    };
    const response = await fetch("/api/interviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message || "创建面经失败，请稍后重试。");
      setBusy(false);
      return;
    }
    router.push(`/interviews/${result.id}` as Route);
  }

  return (
    <form className="panel stack interview-create-form" onSubmit={submit}>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="grid">
        <label>
          关联投递
          <span className="select-wrap">
            <select
              name="applicationId"
              defaultValue={applicationId}
              required
              disabled={Boolean(applicationId)}
            >
              <option value="">请选择投递</option>
              {applications.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
            </svg>
          </span>
          {applicationId && (
            <input type="hidden" name="applicationId" value={applicationId} />
          )}
        </label>
        <label>
          面试轮次
          <span className="select-wrap">
            <select
              name="stage"
              defaultValue={stage}
              disabled={Boolean(stageOccurrenceId)}
              required
            >
              {INTERVIEW_STAGES.map((item) => (
                <option value={item} key={item}>
                  {STAGE_LABELS[item]}
                </option>
              ))}
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
            </svg>
          </span>
        </label>
        <label>
          面试日期
          <input
            name="interviewedOn"
            type="date"
            defaultValue={interviewedOn}
            disabled={Boolean(stageOccurrenceId)}
            required
          />
        </label>
        <label>
          面试形式
          <span className="select-wrap">
            <select name="format" defaultValue="">
              <option value="">未记录</option>
              <option value="online">线上</option>
              <option value="offline">线下</option>
              <option value="phone">电话</option>
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
            </svg>
          </span>
        </label>
        <label>
          时长（分钟）
          <input name="durationMinutes" type="number" min="1" max="600" />
        </label>
      </div>
      <button className="button" disabled={busy}>
        {busy ? "正在创建…" : "开始记录"}
      </button>
    </form>
  );
}
