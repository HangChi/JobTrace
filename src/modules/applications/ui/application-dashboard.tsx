"use client";

import { useCallback, useState } from "react";
import type { AnalyticsSummary } from "@/modules/analytics";
import { AnalyticsPanel } from "@/modules/analytics/ui/analytics-panel";
import { ExportButton } from "@/modules/data-transfer/ui/export-button";
import type {
  ApplicationDetail,
  ApplicationPage,
} from "../application/contracts";
import { ApplicationFilters } from "./application-filters";
import { ApplicationListEmpty } from "./application-list-empty";
import { ApplicationTable } from "./application-table";
import { NewApplicationDialog } from "./application-dialogs";

type Search = Record<string, string | string[] | undefined>;
type ApplicationDashboardProps = {
  initialPage: ApplicationPage;
  initialSummary: AnalyticsSummary;
  query: Search;
  filtered: boolean;
  listQuery: string;
  exportQuery: string;
};

export function ApplicationDashboard(props: ApplicationDashboardProps) {
  return <DashboardState key={props.listQuery} {...props} />;
}

function DashboardState({
  initialPage,
  initialSummary,
  query,
  filtered,
  listQuery,
  exportQuery,
}: ApplicationDashboardProps) {
  const [page, setPage] = useState(initialPage);
  const [summary, setSummary] = useState(initialSummary);

  const refreshDashboard = useCallback(async () => {
    try {
      const [pageResponse, summaryResponse] = await Promise.all([
        fetch(`/api/applications?${listQuery}`, { cache: "no-store" }),
        fetch("/api/analytics/summary", { cache: "no-store" }),
      ]);
      if (pageResponse.ok) {
        setPage((await pageResponse.json()) as ApplicationPage);
      }
      if (summaryResponse.ok) {
        setSummary((await summaryResponse.json()) as AnalyticsSummary);
      }
    } catch {
      // A later navigation reconciles the dashboard if background refresh fails.
    }
  }, [listQuery]);

  function handleCreated(application: ApplicationDetail) {
    if (!filtered && page.page === 1) {
      setPage((current) => ({
        ...current,
        total: current.total + 1,
        items: [application, ...current.items].slice(0, current.limit),
      }));
    }
    setSummary((current) => ({
      ...current,
      total: current.total + 1,
      submitted:
        current.submitted + (application.status === "submitted" ? 1 : 0),
      refused: current.refused + (application.status === "refused" ? 1 : 0),
      offers: current.offers + (application.status === "offer" ? 1 : 0),
      stageDistribution: {
        ...current.stageDistribution,
        screening: (current.stageDistribution.screening ?? 0) + 1,
      },
    }));
    void refreshDashboard();
  }

  return (
    <section className="stack page-gap dashboard">
      <div className="hero-row dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span aria-hidden="true" /> 求职进度工作台
          </p>
          <h1>
            每一次投递，<span>都有迹可循。</span>
          </h1>
          <p className="lead">
            集中管理岗位、面试阶段和待办跟进，把精力留给真正重要的机会。
          </p>
        </div>
        <div className="actions">
          <ExportButton query={exportQuery} />
          <NewApplicationDialog onSuccess={handleCreated} />
        </div>
      </div>
      <AnalyticsPanel summary={summary} />
      <ApplicationFilters query={query} />
      {page.items.length ? (
        <ApplicationTable
          page={page}
          query={query}
          onMutation={() => void refreshDashboard()}
        />
      ) : (
        <ApplicationListEmpty filtered={filtered} onCreated={handleCreated} />
      )}
    </section>
  );
}
