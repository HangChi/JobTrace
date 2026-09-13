import Link from "next/link";
import type { PublicInterviewDetail as Detail } from "../application/contracts";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import { UserAvatar } from "@/modules/identity-access/ui/user-avatar";
import { PublicInterviewContent } from "./public-interview-content";
import { PublicInterviewEngagement } from "./public-interview-engagement";

export function PublicInterviewDetail({ interview }: { interview: Detail }) {
  return (
    <article className="interview-editor stack public-interview-detail">
      <header className="interview-editor-header">
        <div>
          <p className="eyebrow">公开面经 · {STAGE_LABELS[interview.stage]}</p>
          <h1>
            {interview.companyName} · {interview.positionName}
          </h1>
          <p className="lead">
            面试日期 {interview.interviewedOn} · 发布于{" "}
            <time dateTime={interview.publishedAt}>
              {interview.publishedAt.slice(0, 10)}
            </time>
          </p>
        </div>
        <div className="public-interview-author">
          {interview.author ? (
            <>
              <UserAvatar
                className="public-author-avatar"
                image={interview.author.image}
                name={interview.author.username}
              />
              <span>@{interview.author.username}</span>
            </>
          ) : (
            <span>匿名用户</span>
          )}
        </div>
      </header>
      <section className="panel public-interview-detail-content">
        <h2 className="sr-only">面经正文</h2>
        <PublicInterviewContent interview={interview} />
      </section>
      <PublicInterviewEngagement
        interviewId={interview.id}
        initialEngagement={interview.engagement}
        initialComments={interview.recentComments}
      />
      <footer className="interview-editor-footer">
        <Link className="button secondary" href="/interviews">
          返回面经广场
        </Link>
      </footer>
    </article>
  );
}
