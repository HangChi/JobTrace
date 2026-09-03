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
    <form
      className="panel stack admin-source-form admin-sync-setup-card"
      onSubmit={submit}
    >
      <div className="admin-source-form-heading">
        <div>
          <p className="eyebrow">手动配置</p>
          <h2>登记单个来源</h2>
        </div>
        <span className="admin-setup-status is-paused">登记后暂停</span>
      </div>
      <p className="muted admin-setup-description">
        添加未收录的公开或已授权招聘入口，完成检查后再从上方启用。
      </p>
      <div className="admin-source-form-grid">
        <label>
          <span className="admin-form-label-row">
            企业 UUID <small>必填</small>
          </span>
          <input name="companyId" required placeholder="输入企业 UUID" />
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
            <option value="feishu">飞书招聘</option>
            <option value="schema_org">Schema.org</option>
          </select>
        </label>
        <label>
          <span className="admin-form-label-row">
            来源标识 <small>唯一</small>
          </span>
          <input
            name="externalKey"
            required
            placeholder="例如：company-careers"
          />
        </label>
        <label>
          访问依据
          <select name="accessBasis">
            <option value="public">公开来源</option>
            <option value="authorized">已授权</option>
          </select>
        </label>
        <label className="admin-source-url-field">
          HTTPS 入口
          <input
            name="baseUrl"
            type="url"
            pattern="https://.*"
            required
            placeholder="https://careers.example.com"
          />
        </label>
      </div>
      <div className="admin-source-form-footer">
        <span>登记后可在“自动同步来源”中审核与启用</span>
        <button className="button secondary" disabled={busy}>
          {busy ? "正在登记…" : "登记来源"}
        </button>
      </div>
      {message && (
        <p className="admin-sync-message" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
