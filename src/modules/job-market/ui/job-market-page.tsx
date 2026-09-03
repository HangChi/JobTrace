import Link from "next/link";
import type { Route } from "next";
import type { CampaignSummary } from "../domain/entities";
import { PageHeader } from "@/shared/ui/page-header";
import { JobMarketFilters } from "./job-market-filters";
import { CampaignCard } from "./campaign-card";
type Search = Record<string, string | string[] | undefined>;
const ignoredQueryKeys = new Set(["page", "limit", "recruitmentType"]);

function paginationItems(current: number, total: number) {
  const candidates = new Set([1, total, current - 1, current, current + 1]);
  const visible = [...candidates]
    .filter((item) => item >= 1 && item <= total)
    .sort((left, right) => left - right);
  const result: Array<number | "ellipsis"> = [];
  visible.forEach((item, index) => {
    if (index > 0 && item - visible[index - 1] > 1) result.push("ellipsis");
    result.push(item);
  });
  return result;
}

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
  const filtered = Object.entries(query).some(
    ([key, value]) => !ignoredQueryKeys.has(key) && Boolean(value),
  );
  const favoriteOnly = Array.isArray(query.favorite)
    ? query.favorite.includes("true")
    : query.favorite === "true";
  const pages = Math.max(1, Math.ceil(page.total / page.limit));
  const rangeStart = (page.page - 1) * page.limit + 1;
  const rangeEnd = Math.min(page.page * page.limit, page.total);
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (ignoredQueryKeys.has(key)) continue;
      if (Array.isArray(value))
        value.forEach((item) => params.append(key, item));
      else if (value) params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return `${search ? `/?${search}` : "/"}#job-market-results` as Route;
  };
  const favoriteHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (ignoredQueryKeys.has(key) || key === "favorite") continue;
      if (Array.isArray(value))
        value.forEach((item) => params.append(key, item));
      else if (value) params.set(key, value);
    }
    if (!favoriteOnly) params.set("favorite", "true");
    const search = params.toString();
    return (search ? `/?${search}` : "/") as Route;
  })();
  return (
    <section className="stack page-gap job-market-page">
      <PageHeader
        kicker="自动更新"
        title="招聘广场"
        description="自动来源集中展示岗位与城市；暂无公开接口的企业提供官网或公众号招聘原文。"
        meta={[
          {
            label: favoriteOnly
              ? `收藏 ${page.total} 家招聘企业`
              : `共 ${page.total} 家招聘企业`,
            tone: "brand",
          },
        ]}
        actions={
          <Link
            className="job-market-favorite-filter"
            href={favoriteHref}
            aria-pressed={favoriteOnly}
            scroll={false}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m12 3.8 2.5 5.05 5.58.81-4.04 3.94.95 5.56L12 16.54l-4.99 2.62.95-5.56-4.04-3.94 5.58-.81L12 3.8Z" />
            </svg>
            仅看收藏
          </Link>
        }
        toolsLayout="stacked"
      />
      <JobMarketFilters query={query} />
      {page.items.length ? (
        <>
          <div className="campaign-table-shell" id="job-market-results">
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
          {pages > 1 && (
            <nav className="job-market-pagination" aria-label="招聘记录分页">
              <p className="job-market-page-summary">
                <strong>
                  {rangeStart}–{rangeEnd}
                </strong>
                <span>/ {page.total} 家企业</span>
              </p>
              <div className="job-market-page-controls">
                {page.page > 1 ? (
                  <Link
                    className="pagination-link"
                    href={href(page.page - 1)}
                    aria-label="上一页"
                    scroll={false}
                  >
                    <span aria-hidden="true">‹</span>
                  </Link>
                ) : (
                  <span
                    className="pagination-link is-disabled"
                    aria-label="已是第一页"
                    aria-disabled="true"
                  >
                    ‹
                  </span>
                )}
                <div className="pagination-pages">
                  {paginationItems(page.page, pages).map((item, index) =>
                    item === "ellipsis" ? (
                      <span
                        className="pagination-ellipsis"
                        key={`ellipsis-${index}`}
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ) : item === page.page ? (
                      <span
                        className="pagination-page is-current"
                        key={item}
                        aria-current="page"
                      >
                        {item}
                      </span>
                    ) : (
                      <Link
                        className="pagination-page"
                        href={href(item)}
                        key={item}
                        aria-label={`第 ${item} 页`}
                        scroll={false}
                      >
                        {item}
                      </Link>
                    ),
                  )}
                </div>
                {page.page < pages ? (
                  <Link
                    className="pagination-link"
                    href={href(page.page + 1)}
                    aria-label="下一页"
                    scroll={false}
                  >
                    <span aria-hidden="true">›</span>
                  </Link>
                ) : (
                  <span
                    className="pagination-link is-disabled"
                    aria-label="已是最后一页"
                    aria-disabled="true"
                  >
                    ›
                  </span>
                )}
              </div>
              <form className="job-market-page-jump" action="/">
                {Object.entries(query).flatMap(([key, value]) => {
                  if (ignoredQueryKeys.has(key) || !value) return [];
                  const values = Array.isArray(value) ? value : [value];
                  return values.map((item, index) => (
                    <input
                      key={`${key}-${index}`}
                      type="hidden"
                      name={key}
                      value={item}
                    />
                  ));
                })}
                <label htmlFor="job-market-page-number">跳至</label>
                <input
                  id="job-market-page-number"
                  name="page"
                  type="number"
                  min="1"
                  max={pages}
                  defaultValue={page.page}
                  inputMode="numeric"
                />
                <span>页</span>
                <button type="submit">前往</button>
              </form>
            </nav>
          )}
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
