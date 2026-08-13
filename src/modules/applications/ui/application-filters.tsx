import Link from "next/link";
import { APPLICATION_STATUSES, STATUS_LABELS } from "../domain/catalog";

export function ApplicationFilters({
  query,
}: {
  query: Record<string, string | string[] | undefined>;
}) {
  return (
    <form className="panel filter-bar" method="get">
      <label>
        搜索公司或岗位
        <input
          name="q"
          defaultValue={typeof query.q === "string" ? query.q : ""}
          maxLength={200}
          placeholder="例如：产品经理"
        />
      </label>
      <label>
        状态
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
      </label>
      <label>
        排序
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
