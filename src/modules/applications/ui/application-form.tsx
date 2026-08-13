"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { APPLICATION_STATUSES, STATUS_LABELS } from "../domain/catalog";
import { FormField, TextAreaField } from "@/shared/ui/form-field";
import { Feedback } from "@/shared/ui/feedback";

export function ApplicationForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      router.push(`/applications/${result.id}`);
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "保存失败");
      setBusy(false);
    }
  }
  return (
    <form className="panel stack" onSubmit={submit}>
      {error && <Feedback kind="error">{error}</Feedback>}
      <div className="grid">
        <FormField
          label="公司名称 *"
          name="companyName"
          required
          maxLength={200}
        />
        <FormField
          label="岗位名称 *"
          name="positionName"
          required
          maxLength={200}
        />
        <FormField label="投递日期 *" name="appliedDate" type="date" required />
        <FormField label="城市" name="city" maxLength={100} />
      </div>
      <FormField
        label="职位链接"
        name="jobUrl"
        type="url"
        placeholder="https://"
      />
      <label>
        当前状态
        <select name="status" defaultValue="active">
          {APPLICATION_STATUSES.map((v) => (
            <option value={v} key={v}>
              {STATUS_LABELS[v]}
            </option>
          ))}
        </select>
      </label>
      <TextAreaField label="备注" name="notes" maxLength={10000} />
      <div className="actions">
        <button className="button" disabled={busy}>
          {busy ? "正在保存…" : "保存投递"}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => router.back()}
        >
          取消
        </button>
      </div>
    </form>
  );
}
