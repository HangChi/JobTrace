"use client";

import Link from "next/link";
import type { Route } from "next";

export function PublicInterviewFilters({
  query,
  facets,
}: {
  query: Record<string, string | string[] | undefined>;
  facets: { cities: string[]; positions: string[] };
}) {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const companyQuery = first(query.q) ?? "";
  const city = first(query.city) ?? "";
  const position = first(query.position) ?? "";
  const sort = first(query.sort) === "hot" ? "hot" : "latest";
  const sortHref = (value: "latest" | "hot") => {
    const params = new URLSearchParams();
    if (companyQuery) params.set("q", companyQuery);
    if (city) params.set("city", city);
    if (position) params.set("position", position);
    if (value === "hot") params.set("sort", value);
    const search = params.toString();
    return (search ? `/interviews?${search}` : "/interviews") as Route;
  };
  return (
    <form className="public-company-search" method="get" action="/interviews">
      <input type="hidden" name="sort" value={sort} />
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
          aria-label="搜索公司"
        />
      </div>
      <label className="public-filter-select">
        <span className="sr-only">城市</span>
        <select
          name="city"
          defaultValue={city}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="">城市</option>
          {facets.cities.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="public-filter-select">
        <span className="sr-only">岗位</span>
        <select
          name="position"
          defaultValue={position}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          <option value="">岗位</option>
          {facets.positions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <nav className="public-sort-control" aria-label="排序方式">
        <Link
          href={sortHref("latest")}
          aria-current={sort === "latest" ? "page" : undefined}
        >
          最新发布
        </Link>
        <Link
          href={sortHref("hot")}
          aria-current={sort === "hot" ? "page" : undefined}
        >
          按热度
        </Link>
      </nav>
    </form>
  );
}
