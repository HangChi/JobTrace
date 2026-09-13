import Link from "next/link";
import type { Route } from "next";

export function PublicInterviewFilters({
  query,
}: {
  query: Record<string, string | string[] | undefined>;
}) {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const companyQuery = first(query.q) ?? "";
  return (
    <form className="public-company-search" method="get" action="/interviews">
      <label htmlFor="public-company-query">公司</label>
      <div className="public-company-search-field">
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m12.5 12.5 4 4" />
        </svg>
        <input
          id="public-company-query"
          type="search"
          name="q"
          defaultValue={companyQuery}
          placeholder="搜索公司名称"
        />
      </div>
      <button className="public-search-submit" type="submit">
        搜索
      </button>
      {companyQuery ? (
        <Link className="public-search-clear" href={"/interviews" as Route}>
          清除
        </Link>
      ) : null}
    </form>
  );
}
