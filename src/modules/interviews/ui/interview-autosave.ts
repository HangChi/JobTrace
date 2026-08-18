"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InterviewDetail } from "../application/contracts";

export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export function useInterviewAutosave({
  id,
  revision,
  payload,
  onSaved,
}: {
  id: string;
  revision: number;
  payload: object;
  onSaved: (value: InterviewDetail) => void;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const latest = useRef(payload);
  const lastSavedRevision = useRef(0);
  useEffect(() => {
    latest.current = payload;
  }, [payload]);

  const save = useCallback(async () => {
    if (
      !revision ||
      revision <= lastSavedRevision.current ||
      state === "saving"
    )
      return;
    setState("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(latest.current),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setState("conflict");
          setMessage("面经已在其他页面更新，请刷新后继续。");
          return;
        }
        throw new Error(result.message || "保存失败，请重试。");
      }
      lastSavedRevision.current = revision;
      onSaved(result as InterviewDetail);
      setState("saved");
      setMessage(
        `已保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch (reason) {
      setState("error");
      setMessage(
        reason instanceof Error ? reason.message : "保存失败，请重试。",
      );
    }
  }, [id, onSaved, revision, state]);

  useEffect(() => {
    if (!revision || state === "conflict" || state === "error") return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [revision, save, state]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [save]);

  return { state, message, retry: save };
}
