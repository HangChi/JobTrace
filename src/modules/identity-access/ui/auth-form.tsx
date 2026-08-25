"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { AuthActionState } from "@/app/(auth)/actions";

type Mode = "login" | "register" | "forgot" | "reset";
type Action = (
  state: AuthActionState,
  data: FormData,
) => Promise<AuthActionState>;
type IconName = "user" | "profile" | "mail" | "lock";

const fieldLabels: Record<string, string> = {
  displayName: "昵称",
  email: "邮箱",
  recoveryEmail: "恢复邮箱",
  identifier: "邮箱或用户名",
  verificationCode: "邮箱验证码",
  username: "用户名",
  password: "密码",
  confirmPassword: "确认密码",
};

function AuthIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    user: (
      <>
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.75 19c.55-3.25 2.63-5 6.25-5s5.7 1.75 6.25 5" />
      </>
    ),
    profile: (
      <>
        <path d="M12 3.5 13.2 7l3.55.1-2.8 2.2 1 3.4L12 10.75 9.05 12.7l1-3.4-2.8-2.2L10.8 7 12 3.5Z" />
        <path d="M6.5 18.5h11" />
      </>
    ),
    mail: (
      <>
        <rect x="3.5" y="5.25" width="17" height="13.5" rx="2.25" />
        <path d="m5 7 7 5.25L19 7" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2.25" />
        <path d="M8.25 10V7.5a3.75 3.75 0 0 1 7.5 0V10" />
        <path d="M12 14v2" />
      </>
    ),
  };

  return (
    <span className="auth-input-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {paths[name]}
      </svg>
    </span>
  );
}

function VisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {visible ? (
        <>
          <path d="M3.5 12s3.1-5 8.5-5 8.5 5 8.5 5-3.1 5-8.5 5-8.5-5-8.5-5Z" />
          <circle cx="12" cy="12" r="2.2" />
        </>
      ) : (
        <>
          <path d="M5.2 5.2 18.8 18.8" />
          <path d="M9.6 7.35A8.7 8.7 0 0 1 12 7c5.4 0 8.5 5 8.5 5a12.5 12.5 0 0 1-2.3 2.75M14.4 16.65A8.7 8.7 0 0 1 12 17c-5.4 0-8.5-5-8.5-5a12.5 12.5 0 0 1 2.3-2.75" />
        </>
      )}
    </svg>
  );
}

function PasswordToggle({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="auth-password-toggle"
      type="button"
      aria-label={visible ? "隐藏密码" : "显示密码"}
      aria-pressed={visible}
      onClick={onClick}
    >
      <VisibilityIcon visible={visible} />
    </button>
  );
}

export function AuthForm({
  mode,
  action,
  defaultIdentifier,
  returnTo,
  token,
}: {
  mode: Mode;
  action: Action;
  defaultIdentifier?: string;
  returnTo?: string;
  token?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [showPassword, setShowPassword] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [codeMessage, setCodeMessage] = useState("");
  const [codeError, setCodeError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const email = mode === "forgot" || mode === "register";
  const password = mode === "login" || mode === "register" || mode === "reset";
  const fieldErrors = state.fieldErrors ?? {};
  const errorEntries = Object.entries(fieldErrors);

  useEffect(() => {
    if (state.error) errorSummaryRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendRegistrationCode() {
    if (!registrationEmail) {
      setCodeError("请先输入邮箱。");
      return;
    }
    setSendingCode(true);
    setCodeError("");
    setCodeMessage("");
    try {
      const response = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: registrationEmail }),
      });
      const result = (await response.json()) as {
        message?: string;
        fieldErrors?: Array<{ field: string; message: string }>;
      };
      if (!response.ok) {
        const emailError = result.fieldErrors?.find(
          (item) => item.field === "email",
        );
        throw new Error(
          emailError?.message || result.message || "验证码发送失败。",
        );
      }
      setCodeMessage(result.message || "验证码已发送。");
      setCooldown(60);
    } catch (reason) {
      setCodeError(
        reason instanceof Error ? reason.message : "验证码发送失败。",
      );
    } finally {
      setSendingCode(false);
    }
  }

  const describedBy = (...ids: Array<string | false>) =>
    ids.filter(Boolean).join(" ") || undefined;

  return (
    <form
      action={formAction}
      className={`auth-card auth-card-${mode}`}
      aria-busy={pending}
    >
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {mode === "reset" && <input type="hidden" name="token" value={token} />}

      {state.error && (
        <div
          className="auth-error-summary"
          role="alert"
          tabIndex={-1}
          ref={errorSummaryRef}
        >
          <strong>暂时无法提交</strong>
          <p>{state.error}</p>
          {errorEntries.length > 0 && (
            <ul>
              {errorEntries.map(([field, message]) => (
                <li key={field}>
                  <a href={`#${field}`}>
                    {fieldLabels[field] ?? "输入内容"}：{message}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === "login" && (
        <div className="auth-field">
          <div className="auth-field-label">
            <label htmlFor="identifier">邮箱或用户名</label>
            <small>必填</small>
          </div>
          <div className="auth-input-wrap">
            <AuthIcon name="user" />
            <input
              id="identifier"
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="邮箱或用户名"
              defaultValue={defaultIdentifier}
              aria-invalid={Boolean(fieldErrors.identifier)}
              aria-describedby={
                fieldErrors.identifier ? "identifier-error" : undefined
              }
              required
            />
          </div>
          {fieldErrors.identifier && (
            <small className="auth-field-error" id="identifier-error">
              {fieldErrors.identifier}
            </small>
          )}
        </div>
      )}

      {mode === "register" && (
        <div className="auth-field auth-register-username">
          <div className="auth-field-label">
            <label htmlFor="username">用户名</label>
            <small>必填</small>
          </div>
          <div className="auth-input-wrap">
            <AuthIcon name="user" />
            <input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              placeholder="例如：lin_2026"
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={describedBy(
                mode === "register" && "username-hint",
                Boolean(fieldErrors.username) && "username-error",
              )}
              required
            />
          </div>
          {mode === "register" && (
            <small className="auth-field-hint" id="username-hint">
              3–30 位字母、数字或下划线
            </small>
          )}
          {fieldErrors.username && (
            <small className="auth-field-error" id="username-error">
              {fieldErrors.username}
            </small>
          )}
        </div>
      )}

      {mode === "register" && (
        <div className="auth-field auth-register-display-name">
          <div className="auth-field-label">
            <label htmlFor="displayName">昵称</label>
            <small>选填</small>
          </div>
          <div className="auth-input-wrap">
            <AuthIcon name="profile" />
            <input
              id="displayName"
              name="displayName"
              autoComplete="name"
              maxLength={100}
              placeholder="希望我们怎么称呼你"
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={
                fieldErrors.displayName ? "displayName-error" : undefined
              }
            />
          </div>
          {fieldErrors.displayName && (
            <small className="auth-field-error" id="displayName-error">
              {fieldErrors.displayName}
            </small>
          )}
        </div>
      )}

      {email && (
        <div
          className={`auth-field ${mode === "register" ? "auth-register-email" : ""}`}
        >
          <div className="auth-field-label">
            <label htmlFor="email">邮箱</label>
            <small>必填</small>
          </div>
          <div
            className={`auth-input-wrap ${mode === "register" ? "auth-input-with-action" : ""}`}
          >
            <AuthIcon name="mail" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@example.com"
              value={mode === "register" ? registrationEmail : undefined}
              onChange={
                mode === "register"
                  ? (event) => {
                      setRegistrationEmail(event.target.value);
                      setCodeError("");
                      setCodeMessage("");
                    }
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.email || codeError)}
              aria-describedby={describedBy(
                Boolean(fieldErrors.email) && "email-error",
                Boolean(codeError) && "email-code-error",
              )}
              required
            />
            {mode === "register" && (
              <button
                className="button secondary auth-code-button"
                type="button"
                disabled={sendingCode || cooldown > 0}
                onClick={() => void sendRegistrationCode()}
              >
                {sendingCode
                  ? "发送中…"
                  : cooldown > 0
                    ? `${cooldown} 秒`
                    : "发送验证码"}
              </button>
            )}
          </div>
          {fieldErrors.email && (
            <small className="auth-field-error" id="email-error">
              {fieldErrors.email}
            </small>
          )}
          {codeMessage && (
            <small className="auth-code-success">{codeMessage}</small>
          )}
          {codeError && (
            <small
              className="auth-field-error"
              id="email-code-error"
              role="alert"
            >
              {codeError}
            </small>
          )}
        </div>
      )}

      {mode === "register" && (
        <div className="auth-field auth-register-code">
          <div className="auth-field-label">
            <label htmlFor="verificationCode">邮箱验证码</label>
            <small>必填</small>
          </div>
          <div className="auth-input-wrap">
            <AuthIcon name="mail" />
            <input
              id="verificationCode"
              name="verificationCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="6 位验证码"
              aria-invalid={Boolean(fieldErrors.verificationCode)}
              aria-describedby={
                fieldErrors.verificationCode
                  ? "verification-code-error"
                  : undefined
              }
              required
            />
          </div>
          {fieldErrors.verificationCode && (
            <small className="auth-field-error" id="verification-code-error">
              {fieldErrors.verificationCode}
            </small>
          )}
        </div>
      )}

      {password && (
        <div
          className={`auth-field ${mode === "register" ? "auth-register-password" : ""}`}
        >
          <div className="auth-field-label">
            <label htmlFor="password">
              {mode === "reset" ? "新密码" : "密码"}
            </label>
            <small>必填</small>
          </div>
          <div className="auth-input-wrap">
            <AuthIcon name="lock" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? 1 : 8}
              maxLength={mode === "login" ? 128 : 16}
              placeholder={mode === "login" ? "输入你的密码" : "8–16 位密码"}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={describedBy(
                mode !== "login" && "password-hint",
                Boolean(fieldErrors.password) && "password-error",
              )}
              required
            />
            <PasswordToggle
              visible={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            />
          </div>
          {mode !== "login" && (
            <small className="auth-field-hint" id="password-hint">
              8–16 位字符
            </small>
          )}
          {fieldErrors.password && (
            <small className="auth-field-error" id="password-error">
              {fieldErrors.password}
            </small>
          )}
        </div>
      )}

      {mode === "register" && (
        <div className="auth-field auth-register-confirm-password">
          <div className="auth-field-label">
            <label htmlFor="confirmPassword">确认密码</label>
            <small>必填</small>
          </div>
          <div className="auth-input-wrap">
            <AuthIcon name="lock" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              maxLength={16}
              placeholder="再次输入密码"
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? "confirmPassword-error"
                  : undefined
              }
              required
            />
            <PasswordToggle
              visible={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            />
          </div>
          {fieldErrors.confirmPassword && (
            <small className="auth-field-error" id="confirmPassword-error">
              {fieldErrors.confirmPassword}
            </small>
          )}
        </div>
      )}

      {state.message && (
        <p className="feedback success" role="status">
          {state.message}
        </p>
      )}

      <button className="button auth-submit" disabled={pending}>
        {pending && <span className="auth-submit-spinner" aria-hidden="true" />}
        {pending
          ? "正在处理…"
          : (
              {
                login: "登录",
                register: "创建账号",
                forgot: "发送重置说明",
                reset: "更新密码",
              } as const
            )[mode]}
      </button>
    </form>
  );
}
