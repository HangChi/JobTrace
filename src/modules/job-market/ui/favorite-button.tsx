"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function FavoriteButton({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: boolean;
}) {
  const router = useRouter();
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
      router.refresh();
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
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3Z" />
        </svg>
      </button>
      {error && (
        <span role="status" className="sr-only">
          {error}
        </span>
      )}
    </span>
  );
}
