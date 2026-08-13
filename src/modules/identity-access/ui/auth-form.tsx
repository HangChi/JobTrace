"use client";
import { useActionState, useState } from "react";
import type { AuthActionState } from "@/app/(auth)/actions";
type Mode = "login" | "register" | "forgot" | "reset";
type Action = (s: AuthActionState, d: FormData) => Promise<AuthActionState>;
export function AuthForm({ mode, action }: { mode: Mode; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [showPassword, setShowPassword] = useState(false);
  const username = mode === "login" || mode === "register",
    email = mode === "forgot",
    password = mode === "login" || mode === "register" || mode === "reset";
  return (
    <form action={formAction} className="auth-card">
      {mode === "register" && (
        <div className="auth-field">
          <label htmlFor="displayName">怎么称呼你</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              人
            </span>
            <input
              id="displayName"
              name="displayName"
              autoComplete="name"
              maxLength={100}
              placeholder="例如：小林"
            />
          </div>
        </div>
      )}
      {email && (
        <div className="auth-field">
          <label htmlFor="email">邮箱</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              @
            </span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          </div>
        </div>
      )}
      {username && (
        <div className="auth-field">
          <label htmlFor="username">用户名</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon" aria-hidden="true">
              @
            </span>
            <input
              id="username"
              name="username"
              autoComplete="username"
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              placeholder="请输入用户名"
              required
            />
          </div>
        </div>
      )}
      {password && (
        <div className="auth-field">
          <label htmlFor="password">密码</label>
          <div className="auth-input-wrap">
            <span
              className="auth-input-icon auth-lock-icon"
              aria-hidden="true"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? 1 : 8}
              placeholder={mode === "login" ? "输入你的密码" : "至少 8 位字符"}
              required
            />
            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "隐藏" : "显示"}
            </button>
          </div>
          {mode !== "login" && (
            <small className="auth-field-hint">
              建议使用字母、数字和符号的组合
            </small>
          )}
        </div>
      )}
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="feedback success" role="status">
          {state.message}
        </p>
      )}
      <button className="button auth-submit" disabled={pending}>
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
