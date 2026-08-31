"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function SourceForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    const values = Object.fromEntries(new FormData(form));
    try {
      const url = new URL(String(values.baseUrl));
      const response = await fetch("/api/admin/job-market/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: values.companyId,
          adapter: values.adapter,
          externalKey: values.externalKey,
          baseUrl: url.href,
          allowedHosts: [url.hostname],
          countryCodes: [],
          accessBasis: values.accessBasis,
          isOfficial: true,
          syncIntervalMinutes: 360,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setMessage("来源已登记，审核后可启用。");
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登记失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel stack" onSubmit={submit}>
      <div>
        <h2>登记合规来源</h2>
        <p className="muted">先确认公开或授权依据；新来源默认暂停。</p>
      </div>
      <div className="admin-filter-grid">
        <label>
          企业 ID
          <input name="companyId" required placeholder="UUID" />
        </label>
        <label>
          适配器
          <select name="adapter">
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
            <option value="ashby">Ashby</option>
            <option value="smartrecruiters">SmartRecruiters</option>
            <option value="moka">Moka 招聘</option>
            <option value="xiaomi">小米招聘</option>
            <option value="schema_org">Schema.org</option>
          </select>
        </label>
        <label>
          来源标识
          <input name="externalKey" required />
        </label>
        <label>
          HTTPS 入口
          <input name="baseUrl" type="url" pattern="https://.*" required />
        </label>
        <label>
          访问依据
          <select name="accessBasis">
            <option value="public">公开来源</option>
            <option value="authorized">已授权</option>
          </select>
        </label>
      </div>
      <div>
        <button className="button" disabled={busy}>
          {busy ? "正在登记…" : "登记来源"}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
