"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountSession } from "../application/contracts";

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "未知设备";
  if (/iphone|ipad/i.test(userAgent)) return "iPhone / iPad";
  if (/android/i.test(userAgent)) return "Android 设备";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac";
  if (/windows/i.test(userAgent)) return "Windows 设备";
  if (/linux/i.test(userAgent)) return "Linux 设备";
  return "浏览器会话";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export function SessionList({ initial }: { initial: AccountSession[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function revoke(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/profile/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "无法撤销该会话。");
      setSessions((items) => items.filter((item) => item.id !== id));
      if (initial.find((item) => item.id === id)?.current) {
        router.replace("/login");
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法撤销该会话。");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="profile-session-list">
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <ul>
        {sessions.map((session) => (
          <li key={session.id}>
            <span>
              <strong>
                {deviceLabel(session.userAgent)}
                {session.current && <small>当前设备</small>}
              </strong>
              <small>
                登录于 {formatTime(session.createdAt)} · 有效至{" "}
                {formatTime(session.expiresAt)}
              </small>
            </span>
            <button
              type="button"
              className="button ghost compact-button"
              disabled={Boolean(busy)}
              onClick={() => void revoke(session.id)}
            >
              {busy === session.id ? "撤销中…" : "退出此设备"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
