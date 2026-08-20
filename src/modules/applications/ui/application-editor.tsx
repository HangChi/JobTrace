"use client";

import { useState } from "react";
import type { ApplicationDetail } from "../application/contracts";
import {
  APPLICATION_STATUSES,
  RECRUITMENT_STAGES,
  STAGE_LABELS,
  STATUS_LABELS,
} from "../domain/catalog";
import { Feedback } from "@/shared/ui/feedback";
import { FormField, TextAreaField } from "@/shared/ui/form-field";
import Link from "next/link";
import type { Route } from "next";
import type { StageInterviewSummary } from "@/modules/interviews/application/contracts";
import { isInterviewStage } from "@/modules/interviews/domain/catalog";
import { ApplicationHistory } from "./application-history";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

export function ApplicationEditor({
  application,
  interviews = [],
}: {
  application: ApplicationDetail;
  interviews?: StageInterviewSummary[];
}) {
  const [current, setCurrent] = useState(application);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const terminal = current.status === "offer" || current.status === "refused";

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      stages: [],
      version: current.version,
      changeDate: today(),
    };
    const response = await fetch(`/api/applications/${current.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) setError(result.message);
    else {
      setCurrent(result as ApplicationDetail);
      setMessage("修改已保存。");
    }
    setBusy(false);
  }

  async function addStage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch(`/api/applications/${current.id}/stages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    const result = await response.json();
    if (!response.ok) setError(result.message);
    else setCurrent(result as ApplicationDetail);
  }

  async function removeStage(occurrenceId: string) {
    const response = await fetch(
      `/api/applications/${current.id}/stages/${occurrenceId}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changeDate: today() }),
      },
    );
    const result = await response.json();
    if (!response.ok) setError(result.message);
    else setCurrent(result as ApplicationDetail);
  }

  return (
    <div className="stack">
      <form className="panel stack" onSubmit={update}>
        <h2>编辑投递</h2>
        {error && <Feedback kind="error">{error}</Feedback>}
        {message && <Feedback kind="success">{message}</Feedback>}
        <div className="grid">
          <FormField
            label="公司名称 *"
            name="companyName"
            required
            defaultValue={current.companyName}
          />
          <FormField
            label="岗位名称 *"
            name="positionName"
            required
            defaultValue={current.positionName}
          />
          <FormField
            label="投递日期 *"
            name="appliedDate"
            type="date"
            required
            defaultValue={current.appliedDate}
          />
          <FormField
            label="城市"
            name="city"
            defaultValue={current.city ?? ""}
          />
        </div>
        <FormField
          label="职位链接"
          name="jobUrl"
          type="url"
          defaultValue={current.jobUrl ?? ""}
        />
        <label>
          当前状态
          <select name="status" defaultValue={current.status}>
            {APPLICATION_STATUSES.map((status) => (
              <option value={status} key={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <TextAreaField
          label="备注"
          name="notes"
          defaultValue={current.notes ?? ""}
        />
        <button className="button" disabled={busy}>
          {busy ? "正在保存…" : "保存修改"}
        </button>
      </form>
      <section className="panel stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">PIPELINE</p>
            <h2>招聘阶段</h2>
          </div>
          {terminal && <span className="status-badge">流程已结束</span>}
        </div>
        {current.stageOccurrences.length > 0 && (
          <ul className="stage-record-list">
            {current.stageOccurrences.map((item) => (
              <li key={item.id}>
                <span className="stage-record-name">
                  <i aria-hidden="true" />
                  <strong>{STAGE_LABELS[item.stage]}</strong>
                  <time dateTime={item.occurredOn}>{item.occurredOn}</time>
                </span>
                <span className="stage-record-actions">
                  {isInterviewStage(item.stage) &&
                    (() => {
                      const review = interviews.find(
                        (candidate) => candidate.stageOccurrenceId === item.id,
                      );
                      return (
                        <Link
                          className="button secondary"
                          href={
                            (review
                              ? `/interviews/${review.id}`
                              : `/interviews/new?applicationId=${current.id}&stageOccurrenceId=${item.id}`) as Route
                          }
                        >
                          {review ? "继续复盘" : "记录面经"}
                        </Link>
                      );
                    })()}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => removeStage(item.id)}
                    aria-label={`移除${STAGE_LABELS[item.stage]}阶段`}
                  >
                    移除阶段
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {terminal && (
          <p className="terminal-stage-notice">
            {STATUS_LABELS[current.status]} 后不再进入新的招聘阶段。
          </p>
        )}
        <form className="stage-form" onSubmit={addStage}>
          <label>
            阶段
            <span className="select-wrap">
              <select name="stage" disabled={terminal}>
                {RECRUITMENT_STAGES.map((stage) => (
                  <option value={stage} key={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
              </svg>
            </span>
          </label>
          <FormField
            label="发生日期"
            name="occurredOn"
            type="date"
            required
            disabled={terminal}
          />
          <button className="button" disabled={terminal}>
            添加阶段
          </button>
        </form>
      </section>
      <ApplicationHistory application={current} />
    </div>
  );
}
