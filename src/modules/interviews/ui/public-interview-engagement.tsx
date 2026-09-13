"use client";

import { useState, type FormEvent } from "react";
import type {
  PublicInterviewComment,
  PublicInterviewEngagement as Engagement,
} from "../application/contracts";
import { UserAvatar } from "@/modules/identity-access/ui/user-avatar";

type Props = {
  interviewId: string;
  initialEngagement: Engagement;
  initialComments: PublicInterviewComment[];
};

async function responseBody(response: Response) {
  const body = (await response.json()) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? "操作失败，请稍后重试。");
  return body;
}

export function PublicInterviewEngagement({
  interviewId,
  initialEngagement,
  initialComments,
}: Props) {
  const [engagement, setEngagement] = useState(initialEngagement);
  const [comments, setComments] = useState(initialComments);
  const [likePending, setLikePending] = useState(false);
  const [commentPending, setCommentPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function toggleLike() {
    if (likePending) return;
    const previous = engagement;
    const likedByViewer = !previous.likedByViewer;
    setLikePending(true);
    setError("");
    setNotice("");
    setEngagement({
      ...previous,
      likedByViewer,
      likeCount: Math.max(0, previous.likeCount + (likedByViewer ? 1 : -1)),
    });
    try {
      const response = await fetch(
        `/api/interviews/public/${interviewId}/like`,
        {
          method: "POST",
        },
      );
      setEngagement((await responseBody(response)) as Engagement);
    } catch (reason) {
      setEngagement(previous);
      setError(reason instanceof Error ? reason.message : "点赞失败，请重试。");
    } finally {
      setLikePending(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (commentPending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const content = String(data.get("content") ?? "").trim();
    if (!content || content.length > 1000) {
      setError("评论需填写 1 至 1000 个字符。");
      return;
    }
    setCommentPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/interviews/public/${interviewId}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const result = (await responseBody(response)) as {
        comment: PublicInterviewComment;
        engagement: Engagement;
      };
      setComments((current) => [result.comment, ...current].slice(0, 3));
      setEngagement(result.engagement);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "评论失败，请重试。");
    } finally {
      setCommentPending(false);
    }
  }

  async function shareInterview() {
    const url = `${window.location.origin}/interviews/shared/${interviewId}`;
    setError("");
    setNotice("");
    try {
      if (navigator.share) {
        await navigator.share({ title: "JobTrace 面经", url });
        setNotice("已打开系统分享。");
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("面经链接已复制。");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError")
        return;
      setError("分享失败，请重试。");
    }
  }

  return (
    <section className="public-engagement" aria-label="面经互动">
      <div className="public-engagement-metrics">
        <button
          className={engagement.likedByViewer ? "is-liked" : undefined}
          type="button"
          onClick={toggleLike}
          disabled={likePending}
          aria-pressed={engagement.likedByViewer}
          aria-label={`${engagement.likedByViewer ? "取消点赞" : "点赞"}，当前 ${engagement.likeCount} 个赞`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M7.5 21H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.5m0 11V10l3.8-6.1A2 2 0 0 1 15 5v5h3.4a2.5 2.5 0 0 1 2.4 3.2l-1.7 6A2.5 2.5 0 0 1 16.7 21H7.5Z" />
          </svg>
          <span>{engagement.likeCount}</span>
        </button>
        <span aria-label={`${engagement.commentCount} 条评论`}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.4-4.2A9 9 0 1 1 21 12Z" />
          </svg>
          {engagement.commentCount}
        </span>
        <span aria-label={`${engagement.viewCount} 次浏览`}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
          {engagement.viewCount}
        </span>
        <button
          className="public-share-button"
          type="button"
          onClick={shareInterview}
          aria-label="分享面经"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="2" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="19" r="2" />
            <path d="m8 11 8-5M8 13l8 5" />
          </svg>
        </button>
      </div>

      {comments.length ? (
        <ol className="public-comment-list" aria-label="最新评论">
          {comments.map((comment) => (
            <li key={comment.id}>
              <UserAvatar
                className="public-comment-avatar"
                image={comment.author.image}
                name={comment.author.username}
              />
              <div>
                <strong>@{comment.author.username}</strong>
                <p>{comment.content}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <form className="public-comment-form" onSubmit={submitComment}>
        <label className="sr-only" htmlFor={`comment-${interviewId}`}>
          写下你的评论
        </label>
        <textarea
          id={`comment-${interviewId}`}
          name="content"
          rows={1}
          maxLength={1000}
          placeholder="写下你的评论…"
          disabled={commentPending}
        />
        <button type="submit" disabled={commentPending}>
          {commentPending ? "发送中…" : "发送"}
        </button>
      </form>
      <p
        className={`public-engagement-feedback${error ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {error || notice}
      </p>
    </section>
  );
}
