"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function EmailBindingForm({
  email,
  showStatus = true,
}: {
  email: string | null;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState(email);
  const [nextEmail, setNextEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (!nextEmail) {
      setError("请输入要绑定的新邮箱。");
      return;
    }
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/email/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "验证码发送失败。");
      setMessage(result.message || "验证码已发送。");
      setCooldown(60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "验证码发送失败。");
    } finally {
      setSending(false);
    }
  }

  async function bind(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/email", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: nextEmail,
          verificationCode,
          currentPassword,
        }),
      });
      const result = (await response.json()) as {
        email?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(result.message || "邮箱绑定失败。");
      setCurrentEmail(result.email ?? nextEmail.toLowerCase());
      setNextEmail("");
      setVerificationCode("");
      setCurrentPassword("");
      setMessage("邮箱已验证并绑定，现在可以使用该邮箱登录。");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "邮箱绑定失败。");
    } finally {
      setBusy(false);
    }
  }

  async function unbind() {
    if (!currentEmail || !currentPassword) {
      setError("解绑邮箱前请输入当前密码。");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile/email", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "邮箱解绑失败。");
      setCurrentEmail(null);
      setCurrentPassword("");
      setMessage("邮箱已解绑。请继续使用用户名登录。");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "邮箱解绑失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="profile-email-form" onSubmit={bind}>
      {showStatus && (
        <div className="profile-email-status">
          <span className="profile-email-status-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          </span>
          <span className="profile-email-status-copy">
            <small>{currentEmail ? "当前登录邮箱" : "邮箱登录未启用"}</small>
            <strong>{currentEmail ?? "尚未绑定邮箱"}</strong>
            <span>
              {currentEmail
                ? "可使用此邮箱登录，并接收密码重置邮件。"
                : "绑定并验证邮箱后，即可使用邮箱登录和找回密码。"}
            </span>
          </span>
          {currentEmail && (
            <span className="profile-email-verified">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="m5.5 10.2 2.8 2.8 6.2-6.2" />
              </svg>
              已验证
            </span>
          )}
        </div>
      )}
      <div className="profile-email-fields">
        <div className="profile-field profile-email-address-field">
          <label htmlFor="profile-next-email">
            {currentEmail ? "新邮箱" : "邮箱"}
          </label>
          <div className="profile-email-address-control">
            <input
              id="profile-next-email"
              type="email"
              value={nextEmail}
              required
              autoComplete="email"
              placeholder="name@example.com"
              onChange={(event) => setNextEmail(event.target.value)}
            />
            <button
              className="button secondary profile-email-code-button"
              type="button"
              disabled={sending || cooldown > 0}
              onClick={() => void sendCode()}
            >
              {sending
                ? "发送中…"
                : cooldown > 0
                  ? `${cooldown} 秒后重试`
                  : "发送验证码"}
            </button>
          </div>
        </div>
        <div className="profile-email-detail-grid">
          <div className="profile-field">
            <label htmlFor="profile-email-code">邮箱验证码</label>
            <input
              id="profile-email-code"
              value={verificationCode}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 位数字"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              onChange={(event) => setVerificationCode(event.target.value)}
            />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-email-password">当前密码</label>
            <input
              id="profile-email-password"
              type="password"
              value={currentPassword}
              required
              autoComplete="current-password"
              aria-describedby="profile-email-password-hint"
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <span className="field-hint" id="profile-email-password-hint">
              换绑和解绑都需要验证当前密码。
            </span>
          </div>
        </div>
      </div>
      <div className="profile-form-footer profile-email-footer">
        <div className="profile-form-feedback" aria-live="polite">
          {error && <p className="field-error">{error}</p>}
          {!error && message && <p className="profile-success">{message}</p>}
        </div>
        <div className="profile-inline-actions">
          {currentEmail && (
            <button
              className="button ghost profile-email-unbind"
              type="button"
              disabled={busy}
              onClick={() => void unbind()}
            >
              解绑邮箱
            </button>
          )}
          <button className="button" disabled={busy || sending}>
            {busy ? "处理中…" : currentEmail ? "换绑邮箱" : "绑定邮箱"}
          </button>
        </div>
      </div>
    </form>
  );
}
