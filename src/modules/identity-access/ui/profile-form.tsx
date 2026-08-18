"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Actor } from "../application/contracts";

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || "JT";
}

export function ProfileForm({ actor }: { actor: Actor }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(actor.displayName);
  const [image, setImage] = useState(actor.image ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");
    setMessage("");
    const payload = new FormData();
    payload.append("file", file);
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "头像上传失败。");
      setImage(result.url);
      setMessage("头像已上传，保存资料后生效。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "头像上传失败。");
    } finally {
      setUploading(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, image }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "资料保存失败。");
      setDisplayName(result.displayName);
      setImage(result.image ?? "");
      setMessage("个人资料已保存。");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "资料保存失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel profile-form" onSubmit={save}>
      <div className="profile-identity-preview">
        <span
          className={`profile-avatar ${image ? "has-image" : ""}`}
          style={image ? { backgroundImage: `url(${image})` } : undefined}
          aria-label={`${displayName}头像`}
        >
          {!image && initials(displayName)}
        </span>
        <div>
          <strong>{displayName || "未设置昵称"}</strong>
          <p>{actor.email}</p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "上传中…" : "更换头像"}
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </div>
      <label>
        昵称
        <input
          value={displayName}
          maxLength={100}
          required
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      <label>
        头像地址
        <input
          type="url"
          value={image}
          placeholder="上传头像后自动填写，也可以粘贴图片 URL"
          onChange={(event) => setImage(event.target.value)}
        />
      </label>
      <p className="field-hint">支持 PNG、JPG、WEBP、GIF，文件不超过 5MB。</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="profile-success" role="status">
          {message}
        </p>
      )}
      <button className="button" disabled={busy || uploading}>
        {busy ? "保存中…" : "保存资料"}
      </button>
    </form>
  );
}
