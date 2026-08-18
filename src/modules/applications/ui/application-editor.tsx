"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationDetail } from "../application/contracts";
import {
  APPLICATION_STATUSES,
  RECRUITMENT_STAGES,
  STAGE_LABELS,
  STATUS_LABELS,
} from "../domain/catalog";
import { Feedback } from "@/shared/ui/feedback";
import { FormField, TextAreaField } from "@/shared/ui/form-field";

const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

export function ApplicationEditor({
  application,
}: {
  application: ApplicationDetail;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const terminal =
    application.status === "offer" || application.status === "refused";

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      stages: [],
      version: application.version,
      changeDate: today(),
    };
    const response = await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) setError(result.message);
    else {
      setMessage("修改已保存。");
      router.refresh();
    }
    setBusy(false);
  }

  async function addStage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch(`/api/applications/${application.id}/stages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget)),
      ),
    });
    if (!response.ok) setError((await response.json()).message);
    else router.refresh();
  }

  async function removeStage(occurrenceId: string) {
    const response = await fetch(
      `/api/applications/${application.id}/stages/${occurrenceId}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changeDate: today() }),
      },
    );
    if (!response.ok) setError((await response.json()).message);
    else router.refresh();
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
            defaultValue={application.companyName}
          />
          <FormField
            label="岗位名称 *"
            name="positionName"
            required
            defaultValue={application.positionName}
          />
          <FormField
            label="投递日期 *"
            name="appliedDate"
            type="date"
            required
            defaultValue={application.appliedDate}
          />
          <FormField
            label="城市"
            name="city"
            defaultValue={application.city ?? ""}
          />
        </div>
        <FormField
          label="职位链接"
          name="jobUrl"
          type="url"
          defaultValue={application.jobUrl ?? ""}
        />
        <label>
          当前状态
          <select name="status" defaultValue={application.status}>
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
          defaultValue={application.notes ?? ""}
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
        {application.stageOccurrences.length > 0 && (
          <ul className="stage-record-list">
            {application.stageOccurrences.map((item) => (
              <li key={item.id}>
                <span className="stage-record-name">
                  <i aria-hidden="true" />
                  <strong>{STAGE_LABELS[item.stage]}</strong>
                  <time dateTime={item.occurredOn}>{item.occurredOn}</time>
                </span>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => removeStage(item.id)}
                  aria-label={`移除${STAGE_LABELS[item.stage]}阶段`}
                >
                  移除阶段
                </button>
              </li>
            ))}
          </ul>
        )}
        {terminal && (
          <p className="terminal-stage-notice">
            {STATUS_LABELS[application.status]} 后不再进入新的招聘阶段。
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
    </div>
  );
}
