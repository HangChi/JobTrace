import Link from "next/link";

type Search = Record<string, string | string[] | undefined>;
export function JobMarketFilters({ query }: { query: Search }) {
  const value = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  return (
    <form className="job-market-filters" action="/" role="search">
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
        招聘类型
        <select name="recruitmentType" defaultValue={value("recruitmentType")}>
          <option value="">全部</option>
          <option value="campus">校园招聘</option>
          <option value="experienced">社会招聘</option>
          <option value="internship">实习</option>
        </select>
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
      <label className="job-market-check">
        <input
          type="checkbox"
          name="favorite"
          value="true"
          defaultChecked={value("favorite") === "true"}
        />
        仅看收藏
      </label>
      <div className="job-market-filter-actions">
        <button className="button primary" type="submit">
          筛选
        </button>
        <Link className="button secondary" href="/">
          清除筛选
        </Link>
      </div>
    </form>
  );
}
