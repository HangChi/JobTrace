"use client";

import { useState } from "react";
import type {
  ImportDecision,
  ImportPreview as Preview,
  ImportResult,
} from "../application/contracts";
import { Feedback } from "@/shared/ui/feedback";
import { ImportPreview, ImportResultView } from "./import-preview";

export function ImportUploader() {
  const [preview, setPreview] = useState<Preview>();
  const [result, setResult] = useState<ImportResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/imports/preview", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message);
      setPreview(value);
      setResult(undefined);
    } catch (value) {
      setError(value instanceof Error ? value.message : "预检失败");
    } finally {
      setBusy(false);
    }
  }
  async function confirm(decisions: ImportDecision[]) {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/imports/${preview.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisions }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message);
      setResult(value);
      setPreview(undefined);
    } catch (value) {
      setError(value instanceof Error ? value.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      {error && <Feedback kind="error">{error}</Feedback>}
      {!preview && !result && (
        <form className="panel stack" onSubmit={upload}>
          <label>
            选择文件
            <input
              name="file"
              type="file"
              required
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
          </label>
          <p className="muted">支持 UTF-8 CSV 或 XLSX，最大 5MB、10,000 行。</p>
          <button className="button" disabled={busy}>
            {busy ? "正在预检…" : "上传并预检"}
          </button>
        </form>
      )}
      {preview && (
        <ImportPreview preview={preview} busy={busy} onConfirm={confirm} />
      )}{" "}
      {result && <ImportResultView result={result} />}
    </div>
  );
}
