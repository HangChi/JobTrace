import Link from "next/link";
import type { Route } from "next";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import type { PublicInterviewPage } from "../application/contracts";
import { UserAvatar } from "@/modules/identity-access/ui/user-avatar";

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
        <h2>暂时没有公开面经</h2>
        <p>换个筛选条件，或者先完成并分享你的第一篇面经。</p>
        <Link className="button" href={"/interviews/mine" as Route}>
          查看个人面经
        </Link>
      </section>
    );

  return (
    <section className="panel interview-list-panel public-interview-panel">
      <div className="section-heading">
        <div>
          <h2>最新面经</h2>
          <p className="section-description">仅展示作者主动公开的脱敏内容。</p>
        </div>
        <span className="muted">共 {page.total} 篇</span>
      </div>
      <ol className="interview-list public-interview-list">
        {page.items.map((item) => (
          <li key={item.id}>
            <time dateTime={item.interviewedOn}>{item.interviewedOn}</time>
            <div className="interview-list-main">
              <Link href={`/interviews/shared/${item.id}` as Route}>
                <strong>
                  {item.companyName} · {item.positionName}
                </strong>
              </Link>
              <p>
                {STAGE_LABELS[item.stage]} · {item.questionCount} 段面经内容
              </p>
              <p className="muted">
                发布于{" "}
                <time dateTime={item.publishedAt}>
                  {item.publishedAt.slice(0, 10)}
                </time>
              </p>
            </div>
            <div className="public-interview-author">
              {item.author ? (
                <>
                  <UserAvatar
                    className="public-author-avatar"
                    image={item.author.image}
                    name={item.author.username}
                  />
                  <span>@{item.author.username}</span>
                </>
              ) : (
                <span>匿名用户</span>
              )}
            </div>
          </li>
        ))}
      </ol>
      {nextHref && (
        <div className="pagination">
          <Link className="button secondary" href={nextHref as Route}>
            下一页
          </Link>
        </div>
      )}
    </section>
  );
}
