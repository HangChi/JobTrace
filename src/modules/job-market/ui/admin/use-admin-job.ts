"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AdminJobSnapshot = {
  id: string;
  status: "running" | "succeeded" | "failed";
  progress: {
    phase: string;
    current: number;
    total: number | null;
    message: string | null;
  };
  result: unknown;
  error: string | null;
};

type AdminJobStartOptions = {
  url: string;
  body?: unknown;
  runningMessage: string;
  summarize: (result: unknown) => string;
};

const FIRST_POLL_MS = 250;
const POLL_INTERVAL_MS = 1500;

// 启动 admin 长任务并轮询进度；任务由服务端后台执行，
// 页面刷新或组件卸载只中断展示，不影响任务本身。
export function useAdminJob() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const summarizeRef = useRef<(result: unknown) => string>(() => "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function poll(statusUrl: string, delayMs = POLL_INTERVAL_MS) {
    timerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(statusUrl);
        const job = (await response.json()) as AdminJobSnapshot & {
          message?: string;
        };
        if (!response.ok)
          throw new Error(job.message ?? job.error ?? "任务状态查询失败。");
        const { progress } = job;
        setProgressText(
          progress.total
            ? `${progress.phase} ${progress.current ?? 0}/${progress.total}${
                progress.message ? `：${progress.message}` : ""
              }`
            : progress.phase,
        );
        if (job.status === "running") {
          if (!stoppedRef.current) poll(statusUrl);
          return;
        }
        setProgressText(null);
        setBusy(false);
        if (job.status === "succeeded") {
          setMessage(summarizeRef.current(job.result));
          router.refresh();
        } else {
          setMessage(job.error ?? "任务失败。");
        }
      } catch (error) {
        setProgressText(null);
        setBusy(false);
        setMessage(error instanceof Error ? error.message : "任务失败。");
      }
    }, delayMs);
  }

  async function start({
    url,
    body,
    runningMessage,
    summarize,
  }: AdminJobStartOptions) {
    setBusy(true);
    setMessage(runningMessage);
    setProgressText(null);
    summarizeRef.current = summarize;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const started = (await response.json()) as {
        jobId?: string;
        message?: string;
      };
      if (!response.ok || !started.jobId)
        throw new Error(started.message ?? "任务启动失败。");
      poll(`${url}?jobId=${started.jobId}`, FIRST_POLL_MS);
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "任务启动失败。");
    }
  }

  return { busy, progressText, message, start };
}
