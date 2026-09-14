import Link from "next/link";
import type { Route } from "next";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import type {
  PublicAuthor,
  PublicInterviewFeedItem,
  PublicInterviewPage,
} from "../application/contracts";
import { UserAvatar } from "@/modules/identity-access/ui";
import { QUESTION_CATEGORY_LABELS } from "../domain/catalog";
import { MarkdownPreview } from "./markdown-preview";
import { PublicInterviewEngagement } from "./public-interview-engagement";
import { formatPublicationDate } from "./format-publication-date";

function FeedAuthor({ author }: { author: PublicAuthor | null }) {
  return (
    <div className="public-feed-author">
      {author ? (
        <UserAvatar
          className="public-feed-avatar"
          image={author.image}
          name={author.username}
        />
      ) : (
        <span
          className="public-feed-avatar public-feed-anonymous"
          aria-hidden="true"
        >
          匿
        </span>
      )}
      <div>
        <strong>{author ? `@${author.username}` : "匿名用户"}</strong>
        <span>{author ? "署名分享" : "匿名分享"}</span>
      </div>
    </div>
  );
}

function InterviewPreview({
  interview,
}: {
  interview: PublicInterviewFeedItem;
}) {
  const question = interview.questions[0];
  if (!question) return null;
  const answer =
    question.improvedAnswer ??
    question.originalAnswer ??
    question.followUpNotes;
  const answerLabel = question.improvedAnswer
    ? "改进回答"
    : question.originalAnswer
      ? "当时回答"
      : "追问记录";

  return (
    <section className="public-feed-preview" aria-label="面经预览">
      <div className="public-feed-preview-heading">
        <span className="public-feed-status-dot" aria-hidden="true" />
        <strong>{STAGE_LABELS[interview.stage]}</strong>
        <span>{QUESTION_CATEGORY_LABELS[question.category]}</span>
        <small>{interview.questionCount} 个问题</small>
      </div>
      <div className="public-feed-preview-question">
        <MarkdownPreview value={question.question} headingOffset={2} />
      </div>
      {answer ? (
        <div className="public-feed-preview-answer">
          <strong>{answerLabel}</strong>
          <MarkdownPreview value={answer} headingOffset={3} />
        </div>
      ) : null}
    </section>
  );
}

export function PublicInterviewList({
  page,
  nextHref,
}: {
  page: PublicInterviewPage;
  nextHref: string | null;
}) {
  if (!page.items.length)
    return (
      <section className="panel interview-empty-state">
        <h1>暂时没有公开面经</h1>
        <p>换个筛选条件，或者先完成并分享你的第一篇面经。</p>
        <Link className="button" href={"/interviews/mine" as Route}>
          查看个人面经
        </Link>
      </section>
    );

  return (
    <section className="public-feed" aria-labelledby="public-feed-title">
      <header className="public-feed-heading">
        <h1 id="public-feed-title">最新面经</h1>
        <span>共 {page.total} 篇</span>
      </header>
      <ol className="public-feed-list">
        {page.items.map((item) => (
          <li key={item.id}>
            <article className="public-feed-card">
              <header className="public-feed-card-header">
                <FeedAuthor author={item.author} />
                <time dateTime={item.publishedAt}>
                  {formatPublicationDate(item.publishedAt)}
                </time>
              </header>

              <div className="public-feed-card-body">
                <div className="public-feed-company">
                  <Link
                    className="public-feed-title-link"
                    href={`/interviews/shared/${item.id}` as Route}
                  >
                    <h2>
                      {item.companyName} · {item.positionName}
                    </h2>
                  </Link>
                  <span>
                    {item.city ? `${item.city} · ` : ""}面试于{" "}
                    {item.interviewedOn}
                  </span>
                </div>
                <InterviewPreview interview={item} />
              </div>

              <footer className="public-feed-card-footer">
                <Link href={`/interviews/shared/${item.id}` as Route}>
                  {item.questionCount > 1
                    ? `查看全部 ${item.questionCount} 个问题`
                    : "查看完整面经"}
                  <svg aria-hidden="true" viewBox="0 0 16 16">
                    <path d="m6 3.5 4.5 4.5L6 12.5" />
                  </svg>
                </Link>
              </footer>
              <PublicInterviewEngagement
                interviewId={item.id}
                initialEngagement={item.engagement}
                initialComments={item.recentComments}
              />
            </article>
          </li>
        ))}
      </ol>
      {nextHref && (
        <div className="public-feed-pagination">
          <Link className="button secondary" href={nextHref as Route}>
            查看更多面经
          </Link>
        </div>
      )}
    </section>
  );
}
