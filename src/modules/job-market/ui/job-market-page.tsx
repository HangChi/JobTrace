import Link from "next/link";
import type { Route } from "next";
import type { CampaignSummary } from "../domain/entities";
import { PageHeader } from "@/shared/ui/page-header";
import { JobMarketFilters } from "./job-market-filters";
import { CampaignCard } from "./campaign-card";
type Search = Record<string, string | string[] | undefined>;
export function JobMarketPage({
  page,
  query,
}: {
  page: {
    items: CampaignSummary[];
    page: number;
    limit: number;
    total: number;
  };
  query: Search;
}) {
  const filtered = Object.values(query).some(Boolean);
  const pages = Math.max(1, Math.ceil(page.total / page.limit));
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value))
        value.forEach((item) => params.append(key, item));
      else if (value) params.set(key, value);
    }
    params.set("page", String(target));
    return `/?${params}` as Route;
  };
  return (
    <section className="stack page-gap job-market-page">
      <PageHeader
        kicker="自动更新"
        title="招聘广场"
        description="自动来源集中展示岗位与城市；暂无公开接口的企业提供官网或公众号招聘入口。"
        meta={[{ label: `共 ${page.total} 家招聘企业`, tone: "brand" }]}
      />
      <JobMarketFilters query={query} />
      {page.items.length ? (
        <>
          <div className="campaign-table-shell">
            <table className="campaign-table">
              <caption className="sr-only">
                企业招聘岗位、地点、来源与投递入口
              </caption>
              <thead>
                <tr>
                  <th scope="col">企业</th>
                  <th scope="col">岗位</th>
                  <th scope="col">地点</th>
                  <th scope="col">招聘渠道</th>
                  <th scope="col" className="campaign-action-heading">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <CampaignCard key={item.id} campaign={item} />
                ))}
              </tbody>
            </table>
          </div>
          <nav className="job-market-pagination" aria-label="招聘记录分页">
            <Link
              className="button secondary"
              aria-disabled={page.page <= 1}
              href={href(Math.max(1, page.page - 1))}
            >
              上一页
            </Link>
            <span>
              第 {page.page} / {pages} 页
            </span>
            <Link
              className="button secondary"
              aria-disabled={page.page >= pages}
              href={href(Math.min(pages, page.page + 1))}
            >
              下一页
            </Link>
          </nav>
        </>
      ) : (
        <div className="panel job-market-empty">
          <h2>{filtered ? "没有符合条件的招聘记录" : "招聘岗位正在准备中"}</h2>
          <p>
            {filtered
              ? "尝试清除筛选或调整关键词。"
              : "系统会在下一次自动同步后显示已批准来源的岗位。"}
          </p>
          {filtered && (
            <Link className="button primary" href="/">
              清除筛选
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
