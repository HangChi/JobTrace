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
  const latestPayload = useRef(payload);
  const latestRevision = useRef(revision);
  const lastSavedRevision = useRef(0);
  const stateRef = useRef<SaveState>("idle");
  const saving = useRef(false);

  const transition = useCallback((next: SaveState, nextMessage = "") => {
    stateRef.current = next;
    setState(next);
    setMessage(nextMessage);
  }, []);

  useEffect(() => {
    latestPayload.current = payload;
    latestRevision.current = revision;
  }, [payload, revision]);

  const save = useCallback(
    async (force = false, keepalive = false) => {
      const targetRevision = latestRevision.current;
      if (
        !targetRevision ||
        targetRevision <= lastSavedRevision.current ||
        stateRef.current === "conflict"
      ) {
        return;
      }
      if (saving.current) {
        return;
      }
      if (!force && stateRef.current === "error") return;

      saving.current = true;
      transition("saving", "正在保存…");
      try {
        const response = await fetch(`/api/interviews/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(latestPayload.current),
          keepalive,
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 409) {
            transition("conflict", "面经已在其他页面更新，请刷新后继续。");
            return;
          }
          throw new Error(result.message || "保存失败，请重试。");
        }
        lastSavedRevision.current = targetRevision;
        onSaved(result as InterviewDetail);
        transition("saved", "已保存");
      } catch (reason) {
        transition(
          "error",
          reason instanceof Error ? reason.message : "保存失败，请重试。",
        );
      } finally {
        saving.current = false;
      }
    },
    [id, onSaved, transition],
  );

  useEffect(() => {
    if (!revision || state === "conflict" || state === "error") return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [revision, save, state]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") void save(true, true);
    };
    const pagehide = () => void save(true, true);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", pagehide);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [save]);

  useEffect(() => {
    if (state !== "saved") return;
    const timer = window.setTimeout(() => transition("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [state, transition]);

  return {
    state,
    message,
    retry: () => save(true),
    flush: () => save(true, true),
  };
}
