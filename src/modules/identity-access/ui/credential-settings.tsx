"use client";

import { useState } from "react";
import { EmailBindingForm } from "./email-binding-form";
import { PasswordForm } from "./password-form";

type ActiveEditor = "email" | "password" | null;

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m6.5 8 3.5 3.5L13.5 8" />
    </svg>
  );
}

export function CredentialSettings({ email }: { email: string | null }) {
  const [activeEditor, setActiveEditor] = useState<ActiveEditor>(null);

  function toggle(editor: Exclude<ActiveEditor, null>) {
    setActiveEditor((current) => (current === editor ? null : editor));
  }

  const emailOpen = activeEditor === "email";
  const passwordOpen = activeEditor === "password";

  return (
    <div className="credential-settings">
      <section
        className={`credential-settings-item ${emailOpen ? "is-open" : ""}`}
      >
        <div className="credential-settings-row">
          <span className="credential-settings-icon email" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          </span>
          <div className="credential-settings-copy">
            <div className="credential-settings-titleline">
              <h3>登录邮箱</h3>
              {email && (
                <span className="credential-settings-badge">已验证</span>
              )}
            </div>
            <p>{email ?? "尚未绑定邮箱"}</p>
          </div>
          <button
            className="credential-settings-toggle"
            type="button"
            aria-expanded={emailOpen}
            aria-controls="credential-email-editor"
            onClick={() => toggle("email")}
          >
            {emailOpen ? "收起" : email ? "管理邮箱" : "绑定邮箱"}
            <ChevronIcon />
          </button>
        </div>
        {emailOpen && (
          <div
            className="credential-settings-editor credential-settings-editor-email"
            id="credential-email-editor"
          >
            <div className="credential-settings-editor-panel">
              <div className="credential-settings-editor-intro">
                <strong>{email ? "换绑或解绑邮箱" : "绑定登录邮箱"}</strong>
                <span>验证码会发送到你填写的新邮箱。</span>
              </div>
              <EmailBindingForm email={email} showStatus={false} />
            </div>
          </div>
        )}
      </section>

      <section
        className={`credential-settings-item ${passwordOpen ? "is-open" : ""}`}
      >
        <div className="credential-settings-row">
          <span
            className="credential-settings-icon password"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <rect x="5" y="10" width="14" height="10" rx="2.5" />
              <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
              <path d="M12 14v2" />
            </svg>
          </span>
          <div className="credential-settings-copy">
            <div className="credential-settings-titleline">
              <h3>登录密码</h3>
            </div>
            <p>已设置 · 修改后其他设备将自动退出</p>
          </div>
          <button
            className="credential-settings-toggle"
            type="button"
            aria-expanded={passwordOpen}
            aria-controls="credential-password-editor"
            onClick={() => toggle("password")}
          >
            {passwordOpen ? "收起" : "修改密码"}
            <ChevronIcon />
          </button>
        </div>
        {passwordOpen && (
          <div
            className="credential-settings-editor credential-settings-editor-password"
            id="credential-password-editor"
          >
            <div className="credential-settings-editor-panel">
              <div className="credential-settings-editor-intro">
                <strong>设置新密码</strong>
                <span>请输入当前密码确认是你本人操作。</span>
              </div>
              <PasswordForm showHeading={false} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
