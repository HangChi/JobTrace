"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { ApplicationDetail } from "@/modules/applications/application/contracts";
import type { InterviewPage } from "../application/contracts";
import { INTERVIEW_STAGES, isInterviewStage } from "../domain/catalog";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";

type ApplicationOption = { id: string; label: string; appliedDate: string };
type StageOption = ApplicationDetail["stageOccurrences"][number];
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

export function InterviewCreateForm({
  applications,
  applicationId,
  stageOccurrenceId,
  stage,
  stageOccurredOn,
  interviewedOn,
}: {
  applications: ApplicationOption[];
  applicationId?: string;
  stageOccurrenceId?: string;
  stage?: string;
  stageOccurredOn?: string;
  interviewedOn?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingStages, setLoadingStages] = useState(
    Boolean(applicationId && !stageOccurrenceId),
  );
  const [selectedApplication, setSelectedApplication] = useState(
    applicationId ?? "",
  );
  const [availableStages, setAvailableStages] = useState<StageOption[]>([]);
  const [stageChoice, setStageChoice] = useState(stageOccurrenceId ?? "new");
  const [interviewDate, setInterviewDate] = useState(
    interviewedOn ?? stageOccurredOn ?? today(),
  );
  const [recordedOn, setRecordedOn] = useState(stageOccurredOn ?? today());

  const selectedApplicationOption = useMemo(
    () => applications.find((item) => item.id === selectedApplication),
    [applications, selectedApplication],
  );

  useEffect(() => {
    if (!selectedApplication || stageOccurrenceId) return;
    const controller = new AbortController();
    void Promise.all([
      fetch(`/api/applications/${selectedApplication}`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("无法读取招聘阶段。");
        return (await response.json()) as ApplicationDetail;
      }),
      fetch(
        `/api/interviews?applicationId=${encodeURIComponent(selectedApplication)}&limit=100`,
        { signal: controller.signal },
      ).then(async (response) => {
        if (!response.ok) throw new Error("无法读取已有面经。");
        return (await response.json()) as InterviewPage;
      }),
    ])
      .then(([application, interviews]) => {
        const linked = new Set(
          interviews.items
            .map((item) => item.stageOccurrenceId)
            .filter((id): id is string => Boolean(id)),
        );
        const stages = application.stageOccurrences.filter(
          (item) => isInterviewStage(item.stage) && !linked.has(item.id),
        );
        setAvailableStages(stages);
        setStageChoice(stages[0]?.id ?? "new");
        setRecordedOn(stages[0]?.occurredOn ?? today());
        setInterviewDate(stages[0]?.occurredOn ?? today());
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(
          reason instanceof Error ? reason.message : "无法读取招聘阶段。",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStages(false);
      });
    return () => controller.abort();
  }, [selectedApplication, stageOccurrenceId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const selectedOccurrence =
      stageOccurrenceId || (stageChoice !== "new" ? stageChoice : null);
    const body = {
      applicationId: values.applicationId,
      interviewedOn: values.interviewedOn,
      ...(selectedOccurrence
        ? { stageOccurrenceId: selectedOccurrence }
        : { stage: values.stage, stageOccurredOn: values.stageOccurredOn }),
      format: values.format || null,
      durationMinutes: values.durationMinutes
        ? Number(values.durationMinutes)
        : null,
      roundResult: "pending",
    };
    try {
      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "创建面经失败，请稍后重试。");
      router.push(`/interviews/${result.id}` as Route);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "创建面经失败，请稍后重试。",
      );
      setBusy(false);
    }
  }

  const creatingStage = Boolean(stageOccurrenceId)
    ? false
    : stageChoice === "new";

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
              value={selectedApplication}
              required
              disabled={Boolean(applicationId)}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedApplication(value);
                setAvailableStages([]);
                setStageChoice("new");
                setRecordedOn(today());
                setInterviewDate(today());
                setLoadingStages(Boolean(value));
                setError("");
              }}
            >
              <option value="">请选择投递</option>
              {applications.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </span>
          {applicationId && (
            <input type="hidden" name="applicationId" value={applicationId} />
          )}
        </label>
        {selectedApplication && !stageOccurrenceId && (
          <label>
            关联阶段
            <span className="select-wrap">
              <select
                value={stageChoice}
                disabled={loadingStages}
                onChange={(event) => {
                  const value = event.target.value;
                  const occurrence = availableStages.find(
                    (item) => item.id === value,
                  );
                  setStageChoice(value);
                  setRecordedOn(occurrence?.occurredOn ?? today());
                  setInterviewDate(occurrence?.occurredOn ?? today());
                }}
              >
                {availableStages.map((item) => (
                  <option value={item.id} key={item.id}>
                    {STAGE_LABELS[item.stage]} · {item.occurredOn}
                  </option>
                ))}
                <option value="new">补录新的面试 / 测评阶段</option>
              </select>
            </span>
          </label>
        )}
        <label>
          面试 / 测评阶段
          <span className="select-wrap">
            <select
              name="stage"
              defaultValue={stage}
              disabled={!creatingStage}
              required={creatingStage}
            >
              {INTERVIEW_STAGES.map((item) => (
                <option value={item} key={item}>
                  {STAGE_LABELS[item]}
                </option>
              ))}
            </select>
          </span>
        </label>
        {creatingStage && (
          <label>
            阶段记录日期
            <input
              aria-label="阶段记录日期"
              name="stageOccurredOn"
              type="date"
              value={recordedOn}
              min={selectedApplicationOption?.appliedDate}
              max={today()}
              onChange={(event) => setRecordedOn(event.target.value)}
              required
            />
            <span className="field-hint">
              通常填写收到通知或状态变化的日期。
            </span>
          </label>
        )}
        <label>
          面试 / 测评日期
          <input
            aria-label="面试 / 测评日期"
            name="interviewedOn"
            type="date"
            value={interviewDate}
            min={selectedApplicationOption?.appliedDate}
            max={today()}
            onChange={(event) => setInterviewDate(event.target.value)}
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
          </span>
        </label>
        <label>
          时长（分钟）
          <input name="durationMinutes" type="number" min="1" max="600" />
        </label>
      </div>
      <button className="button" disabled={busy || loadingStages}>
        {busy ? "正在创建…" : loadingStages ? "正在读取阶段…" : "开始记录"}
      </button>
    </form>
  );
}
