"use client";

import { useId, useState } from "react";

type FieldErrors = Partial<
  Record<"currentPassword" | "newPassword" | "confirmPassword", string>
>;

function VisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.7 10.7 0 0 1 12 4c5.2 0 8.6 4.6 9 6.8a4.7 4.7 0 0 1-.8 1.8M6.2 6.2C4.4 7.5 3.3 9.3 3 10.8 3.4 13 6.8 17.6 12 17.6c1.3 0 2.5-.3 3.5-.7" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

type PasswordFieldProps = {
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  onChange: (value: string) => void;
  value: string;
};

function PasswordField({
  autoComplete,
  error,
  hint,
  label,
  maxLength,
  minLength,
  onChange,
  value,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="profile-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          minLength={minLength}
          maxLength={maxLength}
          required
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [hintId, errorId].filter(Boolean).join(" ") || undefined
          }
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-field-toggle"
          aria-label={`${visible ? "隐藏" : "显示"}${label}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <VisibilityIcon visible={visible} />
        </button>
      </div>
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setFieldErrors({});
    if (newPassword.length < 8 || newPassword.length > 16) {
      setFieldErrors({ newPassword: "新密码请输入 8–16 位。" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: "两次输入的新密码不一致。" });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        const fields = Object.fromEntries(
          (result.fieldErrors ?? []).map(
            (item: { field: string; message: string }) => [
              item.field,
              item.message,
            ],
          ),
        ) as FieldErrors;
        setFieldErrors(fields);
        throw new Error(result.message || "密码修改失败。");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(result.message || "密码已更新。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "密码修改失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="password-form" onSubmit={submit}>
      <div className="password-form-heading">
        <strong>更新登录密码</strong>
        <p>更新后，其他设备将自动退出，当前设备不受影响。</p>
      </div>

      <div className="password-fields">
        <PasswordField
          label="当前密码"
          value={currentPassword}
          maxLength={128}
          autoComplete="current-password"
          error={fieldErrors.currentPassword}
          onChange={setCurrentPassword}
        />
        <PasswordField
          label="新密码"
          value={newPassword}
          minLength={8}
          maxLength={16}
          autoComplete="new-password"
          hint="请输入 8–16 位密码。"
          error={fieldErrors.newPassword}
          onChange={setNewPassword}
        />
        <PasswordField
          label="确认新密码"
          value={confirmPassword}
          minLength={8}
          maxLength={16}
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          onChange={setConfirmPassword}
        />
      </div>

      <div className="profile-form-footer password-form-footer">
        <div className="profile-form-feedback" aria-live="polite">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!error && message && <p className="profile-success">{message}</p>}
        </div>
        <button className="button" disabled={busy}>
          {busy ? "更新中…" : "更新密码"}
        </button>
      </div>
    </form>
  );
}
