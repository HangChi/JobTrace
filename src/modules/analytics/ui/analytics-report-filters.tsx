import Link from "next/link";
import type { Route } from "next";
import type { AnalyticsResolvedRange } from "../application/contracts";
import {
  APPLICATION_TYPES,
  TYPE_LABELS,
} from "@/modules/applications/domain/catalog";

const PERIOD_OPTIONS = [
  ["30d", "近 30 天"],
  ["90d", "近 90 天"],
  ["180d", "近 180 天"],
  ["ytd", "今年"],
  ["all", "全部历史"],
  ["custom", "自定义"],
] as const;

export function AnalyticsReportFilters({
  query,
  cities,
}: {
  query: AnalyticsResolvedRange;
  cities: string[];
}) {
  const cityOptions =
    query.hasCityFilter && query.city && !cities.includes(query.city)
      ? [query.city, ...cities]
      : cities;
  return (
    <form className="panel analytics-report-filters" action="/analytics">
      <div className="analytics-filter-heading">
        <div>
          <h2>分析范围</h2>
        </div>
        <Link href={"/analytics" as Route} className="filter-reset-link">
          恢复默认
        </Link>
      </div>
      {query.error && (
        <p className="analytics-filter-error" role="alert">
          {query.error}
        </p>
      )}
      <div className="analytics-filter-grid">
        <label>
          <span>周期</span>
          <select name="period" defaultValue={query.period}>
            {PERIOD_OPTIONS.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>开始日期</span>
          <input name="from" type="date" defaultValue={query.from ?? ""} />
        </label>
        <label>
          <span>结束日期</span>
          <input name="to" type="date" defaultValue={query.to ?? ""} />
        </label>
        <label>
          <span>求职类型</span>
          <select name="type" defaultValue={query.type ?? "__all__"}>
            <option value="__all__">全部类型</option>
            {APPLICATION_TYPES.map((type) => (
              <option value={type} key={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>城市</span>
          <select
            name="city"
            defaultValue={query.hasCityFilter ? (query.city ?? "") : "__all__"}
          >
            <option value="__all__">全部城市</option>
            <option value="">未填写</option>
            {cityOptions.map((city) => (
              <option value={city} key={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
        <button className="button analytics-filter-submit" type="submit">
          应用筛选
        </button>
      </div>
      <p className="analytics-filter-note">
        以投递日期确定分析范围；入选投递后续发生的阶段、面经和最终结果仍会计入。
      </p>
    </form>
  );
}
