"use client";

import { useMemo, useState } from "react";
import type { AnalyticsDimensionRow } from "../application/contracts";

type SortKey = "applications" | "interviewRate" | "offerRate";

export function DimensionComparison({
  types,
  cities,
}: {
  types: AnalyticsDimensionRow[];
  cities: AnalyticsDimensionRow[];
}) {
  const [tab, setTab] = useState<"type" | "city">("type");
  const [sort, setSort] = useState<SortKey>("applications");
  const rows = useMemo(
    () =>
      [...(tab === "type" ? types : cities)].sort(
        (a, b) => b[sort] - a[sort] || b.applications - a.applications,
      ),
    [cities, sort, tab, types],
  );
  return (
    <section
      className="panel analytics-report-panel dimension-panel"
      aria-labelledby="dimension-title"
    >
      <div className="analytics-report-panel-heading">
        <div>
          <h2 id="dimension-title">维度对比</h2>
        </div>
        <div className="dimension-tabs" role="tablist" aria-label="对比维度">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "type"}
            onClick={() => setTab("type")}
          >
            求职类型
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "city"}
            onClick={() => setTab("city")}
          >
            城市
          </button>
        </div>
      </div>
      {rows.length ? (
        <div className="analytics-table-scroll">
          <table className="dimension-table">
            <thead>
              <tr>
                <th>{tab === "type" ? "求职类型" : "城市"}</th>
                {(["applications", "interviewRate", "offerRate"] as const).map(
                  (key) => (
                    <th
                      key={key}
                      aria-sort={sort === key ? "descending" : "none"}
                    >
                      <button type="button" onClick={() => setSort(key)}>
                        {key === "applications"
                          ? "样本数"
                          : key === "interviewRate"
                            ? "面试率"
                            : "Offer 率"}
                        <span aria-hidden="true">↕</span>
                      </button>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <strong>{row.label}</strong>
                    {!row.sampleSufficient && <small>样本较少</small>}
                  </td>
                  <td>{row.applications}</td>
                  <td>{row.interviewRate}%</td>
                  <td>{row.offerRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="analytics-panel-empty">当前范围内没有可比较的数据。</p>
      )}
    </section>
  );
}
