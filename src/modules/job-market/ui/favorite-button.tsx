"use client";
import { useState } from "react";
export function FavoriteButton({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: boolean;
}) {
  const [favorite, setFavorite] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    const next = !favorite;
    setFavorite(next);
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/job-market/campaigns/${campaignId}/favorite`,
        { method: next ? "PUT" : "DELETE" },
      );
      if (!response.ok) throw new Error();
    } catch {
      setFavorite(!next);
      setError("收藏失败，请重试");
    } finally {
      setPending(false);
    }
  }
  return (
    <span className="favorite-wrap">
      <button
        type="button"
        className="favorite-button"
        aria-pressed={favorite}
        aria-label={favorite ? "取消收藏" : "收藏招聘记录"}
        onClick={toggle}
        disabled={pending}
      >
        {favorite ? "★" : "☆"}
      </button>
      {error && (
        <span role="status" className="sr-only">
          {error}
        </span>
      )}
    </span>
  );
}
