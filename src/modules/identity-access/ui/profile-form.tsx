"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "../application/contracts";

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || "JT";
}

type EditableProfile = Pick<Profile, "displayName" | "image" | "username">;

export function ProfileForm({ profile }: { profile: EditableProfile }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [image, setImage] = useState(profile.image ?? "");
  const [saved, setSaved] = useState({
    displayName: profile.displayName,
    image: profile.image ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = displayName !== saved.displayName || image !== saved.image;

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
    if (!dirty) return;
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
      const next = {
        displayName: result.displayName,
        image: result.image ?? "",
      };
      setDisplayName(next.displayName);
      setImage(next.image);
      setSaved(next);
      setMessage("个人资料已保存。");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "资料保存失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="profile-form" onSubmit={save}>
      <div className="profile-avatar-editor">
        <span
          className={`profile-avatar profile-avatar-large ${image ? "has-image" : ""}`}
          style={image ? { backgroundImage: `url(${image})` } : undefined}
          role="img"
          aria-label={`${displayName || "默认"}头像`}
        >
          {!image && initials(displayName)}
        </span>
        <div className="profile-avatar-copy">
          <strong>你的头像</strong>
          <p>支持 PNG、JPG、WEBP、GIF，文件不超过 5MB。</p>
          <div className="profile-inline-actions">
            <button
              type="button"
              className="button secondary compact-button"
              disabled={uploading || busy}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "上传中…" : image ? "更换头像" : "上传头像"}
            </button>
            {image && (
              <button
                type="button"
                className="button ghost compact-button"
                disabled={uploading || busy}
                onClick={() => {
                  setImage("");
                  setError("");
                  setMessage("默认头像将在保存资料后生效。");
                }}
              >
                移除头像
              </button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="选择头像图片"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </div>

      <div className="profile-field-grid">
        <div className="profile-field">
          <label htmlFor="profile-display-name">昵称</label>
          <input
            id="profile-display-name"
            value={displayName}
            maxLength={100}
            required
            autoComplete="name"
            aria-describedby="profile-name-hint"
            onChange={(event) => {
              setDisplayName(event.target.value);
              setMessage("");
            }}
          />
          <span className="field-hint" id="profile-name-hint">
            用于工作台和账号菜单，最多 100 个字符。
          </span>
        </div>
        <div className="profile-field">
          <label htmlFor="profile-username">用户名</label>
          <input
            id="profile-username"
            value={`@${profile.username}`}
            readOnly
            aria-describedby="profile-username-hint"
          />
          <span className="field-hint" id="profile-username-hint">
            用户名用于登录，当前不可修改。
          </span>
        </div>
      </div>

      <div className="profile-form-footer">
        <div className="profile-form-feedback" aria-live="polite">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!error && message && <p className="profile-success">{message}</p>}
          {!error && !message && dirty && (
            <p className="profile-unsaved">你有尚未保存的更改。</p>
          )}
        </div>
        <button
          className="button profile-save-button"
          disabled={busy || uploading || !dirty}
        >
          {busy ? "保存中…" : "保存资料"}
        </button>
      </div>
    </form>
  );
}
