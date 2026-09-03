import Link from "next/link";

type Search = Record<string, string | string[] | undefined>;
export function JobMarketFilters({ query }: { query: Search }) {
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const favoriteOnly = value("favorite") === "true";
  return (
    <form className="job-market-filters" action="/" role="search">
      {favoriteOnly ? (
        <input type="hidden" name="favorite" value="true" />
      ) : null}
      <label>
        关键词
        <input name="q" defaultValue={value("q")} placeholder="公司或岗位" />
      </label>
      <label>
        企业
        <input name="company" defaultValue={value("company")} />
      </label>
      <label>
        地点
        <input name="location" defaultValue={value("location")} />
      </label>
      <label>
        状态
        <select name="status" defaultValue={value("status")}>
          <option value="">全部</option>
          <option value="open">有效</option>
          <option value="stale">待确认</option>
          <option value="closed">已失效</option>
        </select>
      </label>
      <label>
        发布时间
        <input
          type="date"
          name="postedFrom"
          defaultValue={value("postedFrom")}
        />
      </label>
      <div className="job-market-filter-footer">
        <div className="job-market-filter-actions">
          <Link className="button secondary" href="/">
            清除筛选
          </Link>
          <button className="button primary" type="submit">
            筛选
          </button>
        </div>
      </div>
    </form>
  );
}
