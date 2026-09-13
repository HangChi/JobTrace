import Link from "next/link";
import type { Route } from "next";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import type {
  PublicAuthor,
  PublicInterviewPage,
} from "../application/contracts";
import { UserAvatar } from "@/modules/identity-access/ui/user-avatar";
import { PublicInterviewContent } from "./public-interview-content";

const publishedDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Shanghai",
});

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
                  {publishedDate.format(new Date(item.publishedAt))}
                </time>
              </header>

              <div className="public-feed-card-body">
                <Link
                  className="public-feed-title-link"
                  href={`/interviews/shared/${item.id}` as Route}
                >
                  <h2>
                    {item.companyName} · {item.positionName}
                  </h2>
                </Link>
                <p className="public-feed-meta">
                  <span>{STAGE_LABELS[item.stage]}</span>
                  <span>面试于 {item.interviewedOn}</span>
                </p>
                <PublicInterviewContent interview={item} />
              </div>

              <footer className="public-feed-card-footer">
                <span>{item.questionCount} 段面经内容</span>
                <Link href={`/interviews/shared/${item.id}` as Route}>
                  查看详情
                  <svg aria-hidden="true" viewBox="0 0 16 16">
                    <path d="m6 3.5 4.5 4.5L6 12.5" />
                  </svg>
                </Link>
              </footer>
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
