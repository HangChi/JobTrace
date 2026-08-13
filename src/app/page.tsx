import Link from "next/link";
import { getAnalyticsSummary } from "@/modules/analytics";
import { AnalyticsPanel } from "@/modules/analytics/ui/analytics-panel";
import { listApplications } from "@/modules/applications";
import { ApplicationFilters } from "@/modules/applications/ui/application-filters";
import { ApplicationListEmpty } from "@/modules/applications/ui/application-list-empty";
import { ApplicationTable } from "@/modules/applications/ui/application-table";
import { ExportButton } from "@/modules/data-transfer/ui/export-button";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

function toSearchParams(search: Search) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  }
  return params;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const [page, summary] = await Promise.all([
    listApplications(toSearchParams(search)),
    getAnalyticsSummary(),
  ]);
  const filtered = Object.values(search).some(Boolean);
  return (
    <section className="stack page-gap">
      <div className="hero-row">
        <div>
          <p className="badge">你的求职进度，一眼清楚</p>
          <h1>投递工作台</h1>
          <p className="lead">集中管理岗位、面试阶段与需要跟进的机会。</p>
        </div>
        <div className="actions">
          <ExportButton query={toSearchParams(search).toString()} />
          <Link className="button" href="/applications/new">
            新增投递
          </Link>
        </div>
      </div>
      <AnalyticsPanel summary={summary} />
      <ApplicationFilters query={search} />
      {page.items.length ? (
        <ApplicationTable page={page} />
      ) : (
        <ApplicationListEmpty filtered={filtered} />
      )}
    </section>
  );
}
