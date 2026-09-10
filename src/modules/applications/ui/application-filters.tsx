"use client";

import { useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "../domain/catalog";

const PAGE_SIZES = ["10", "20", "50", "100"];

export function ApplicationFilters({
  query,
}: {
  query: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const limit =
    typeof query.limit === "string" && PAGE_SIZES.includes(query.limit)
      ? query.limit
      : "10";
  const currentSort = typeof query.sort === "string" ? query.sort : null;
  const currentDirection =
    query.direction === "asc" || query.direction === "desc"
      ? query.direction
      : currentSort === "company" || currentSort === "position"
        ? "asc"
        : "desc";

  function sortLabel(value: string, label: string) {
    if (value !== currentSort) return label;
    return `${label} ${currentDirection === "asc" ? "↑" : "↓"}`;
  }

  function navigate(params: URLSearchParams) {
    const suffix = params.toString();
    startTransition(() =>
      router.push(
        (suffix ? `/applications?${suffix}` : "/applications") as Route,
        { scroll: false },
      ),
    );
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string" && value) params.append(key, value);
    }
    const nextSort = form.get("sort");
    if (typeof nextSort === "string" && nextSort) {
      const nextDirection =
        nextSort === currentSort
          ? currentDirection === "asc"
            ? "desc"
            : "asc"
          : "asc";
      params.set("direction", nextDirection);
    }
    navigate(params);
  }

  return (
    <form
      className="panel filter-bar"
      aria-label="筛选投递记录"
      onSubmit={applyFilters}
      aria-busy={pending}
    >
      <input type="hidden" name="limit" value={limit} />
      <label>
        搜索公司或岗位
        <input
          className="search-input"
          name="q"
          defaultValue={typeof query.q === "string" ? query.q : ""}
          maxLength={200}
          placeholder="例如：产品经理"
          disabled={pending}
        />
      </label>
      <label>
        状态
        <span className="select-wrap">
          <select
            name="status"
            disabled={pending}
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
        类型
        <span className="select-wrap">
          <select
            name="type"
            disabled={pending}
            defaultValue={typeof query.type === "string" ? query.type : ""}
          >
            <option value="">全部类型</option>
            {APPLICATION_TYPES.map((type) => (
              <option value={type} key={type}>
                {TYPE_LABELS[type]}
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
            disabled={pending}
            defaultValue={typeof query.sort === "string" ? query.sort : ""}
          >
            <option value="">默认排序（已投递优先）</option>
            <option value="latestDate">
              {sortLabel("latestDate", "最新日期")}
            </option>
            <option value="appliedDate">
              {sortLabel("appliedDate", "投递日期")}
            </option>
            <option value="company">{sortLabel("company", "公司名称")}</option>
            <option value="position">
              {sortLabel("position", "岗位名称")}
            </option>
          </select>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
          </svg>
        </span>
      </label>
      <div className="application-filter-actions">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "更新中…" : "应用条件"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={() => navigate(new URLSearchParams({ limit }))}
        >
          清空
        </button>
      </div>
    </form>
  );
}
