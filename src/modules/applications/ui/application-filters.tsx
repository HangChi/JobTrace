import Link from "next/link";
import { APPLICATION_STATUSES, STATUS_LABELS } from "../domain/catalog";

export function ApplicationFilters({
  query,
}: {
  query: Record<string, string | string[] | undefined>;
}) {
  return (
    <form className="panel filter-bar" method="get" aria-label="筛选投递记录">
      <label>
        搜索公司或岗位
        <input
          className="search-input"
          name="q"
          defaultValue={typeof query.q === "string" ? query.q : ""}
          maxLength={200}
          placeholder="例如：产品经理"
        />
      </label>
      <label>
        状态
        <span className="select-wrap">
          <select
            name="status"
            defaultValue={typeof query.status === "string" ? query.status : ""}
          >
            <option value="">全部状态</option>
            {APPLICATION_STATUSES.map((status) => (
              <option value={status} key={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
          </svg>
        </span>
      </label>
      <label>
        排序
        <span className="select-wrap">
          <select
            name="sort"
            defaultValue={
              typeof query.sort === "string" ? query.sort : "latestDate"
            }
          >
            <option value="latestDate">最近进展</option>
            <option value="appliedDate">投递日期</option>
            <option value="company">公司名称</option>
            <option value="position">岗位名称</option>
          </select>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
          </svg>
        </span>
      </label>
      <button className="button" type="submit">
        应用条件
      </button>
      <Link className="button secondary" href="/">
        清空
      </Link>
    </form>
  );
}
