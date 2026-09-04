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
  const [sourceFile, setSourceFile] = useState<File>();
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData(event.currentTarget);
      const fileInput = event.currentTarget.elements.namedItem("file");
      const file =
        fileInput instanceof HTMLInputElement
          ? fileInput.files?.[0]
          : undefined;
      if (file) {
        setSourceFile(file);
        body.set("file", file);
      }
      const response = await fetch("/api/imports/preview", {
        method: "POST",
        body,
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
  async function remap(mapping: Record<string, string>) {
    if (!preview || !sourceFile) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", sourceFile);
      body.set("mapping", JSON.stringify(mapping));
      body.set("replaceBatchId", preview.id);
      const response = await fetch("/api/imports/preview", {
        method: "POST",
        body,
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message);
      setPreview(value);
    } catch (value) {
      setError(value instanceof Error ? value.message : "重新预检失败");
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
          <div className="transfer-form-heading">
            <h2>选择导入文件</h2>
            <p>文件只会先进行检查，确认前不会写入数据。</p>
          </div>
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
        <ImportPreview
          key={preview.id}
          preview={preview}
          busy={busy}
          onConfirm={confirm}
          onRemap={remap}
        />
      )}{" "}
      {result && <ImportResultView result={result} />}
    </div>
  );
}
