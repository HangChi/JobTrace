import {
  INTERVIEW_STAGES,
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  ROUND_RESULTS,
  ROUND_RESULT_LABELS,
} from "../domain/catalog";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import Link from "next/link";
import type { Route } from "next";

export function InterviewFilters({
  query,
}: {
  query: Record<string, string | string[] | undefined>;
}) {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return (
    <form className="panel interview-filters" method="get" action="/interviews">
      <label className="filter-search">
        搜索
        <input
          type="search"
          name="q"
          defaultValue={first(query.q)}
          placeholder="公司、岗位或问题"
        />
      </label>
      <label>
        复盘状态
        <select name="status" defaultValue={first(query.status) ?? ""}>
          <option value="">全部</option>
          {REVIEW_STATUSES.map((value) => (
            <option key={value} value={value}>
              {REVIEW_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        面试轮次
        <select name="stage" defaultValue={first(query.stage) ?? ""}>
          <option value="">全部</option>
          {INTERVIEW_STAGES.map((value) => (
            <option key={value} value={value}>
              {STAGE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        本轮结果
        <select name="result" defaultValue={first(query.result) ?? ""}>
          <option value="">全部</option>
          {ROUND_RESULTS.map((value) => (
            <option key={value} value={value}>
              {ROUND_RESULT_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        开始日期
        <input
          type="date"
          name="interviewedFrom"
          defaultValue={first(query.interviewedFrom)}
        />
      </label>
      <label>
        结束日期
        <input
          type="date"
          name="interviewedTo"
          defaultValue={first(query.interviewedTo)}
        />
      </label>
      <div className="filter-actions">
        <button className="button" type="submit">
          筛选
        </button>
        <Link className="button secondary" href={"/interviews" as Route}>
          清除
        </Link>
      </div>
    </form>
  );
}
