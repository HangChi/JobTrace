import Link from "next/link";
import type { Route } from "next";
import { listPublicInterviews } from "@/modules/interviews";
import { PublicInterviewFilters } from "@/modules/interviews/ui/public-interview-filters";
import { PublicInterviewList } from "@/modules/interviews/ui/public-interview-list";
import { requirePageUser } from "@/modules/identity-access";
import { toSearchParams } from "@/shared/url/search-params";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;

function MineLink({ className }: { className: string }) {
  return (
    <Link className={className} href={"/interviews/mine" as Route}>
      <span>
        <small>个人空间</small>
        <strong>我的面经</strong>
      </span>
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <path d="m6 3.5 4.5 4.5L6 12.5" />
      </svg>
    </Link>
  );
}

export default async function InterviewSquarePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePageUser();
  const search = await searchParams;
  const params = toSearchParams(search);
  const page = await listPublicInterviews(params);
  const next = new URLSearchParams();
  const companyQuery = params.get("q");
  if (companyQuery) next.set("q", companyQuery);
  for (const key of ["city", "position", "sort"] as const) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  if (page.nextCursor) next.set("cursor", page.nextCursor);
  return (
    <section className="interview-square-page">
      <div className="public-feed-toolbar">
        <PublicInterviewFilters query={search} facets={page.facets} />
        <MineLink className="public-mine-link public-mine-link-toolbar" />
      </div>
      <div className="public-square-layout">
        <PublicInterviewList
          page={page}
          nextHref={page.nextCursor ? `/interviews?${next.toString()}` : null}
        />
        <aside className="public-feed-sidebar" aria-label="面经广场辅助信息">
          <MineLink className="public-mine-link public-sidebar-primary" />
          <section className="public-sidebar-card public-sidebar-count">
            <span>公开动态</span>
            <p>
              <strong>{page.total}</strong>
              <small>篇面经</small>
            </p>
          </section>
          <section className="public-sidebar-card public-sidebar-guide">
            <h2>分享说明</h2>
            <ul>
              <li>完成复盘后才可公开</li>
              <li>公开时默认匿名分享</li>
              <li>可随时切回私有状态</li>
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}
