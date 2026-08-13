import Link from "next/link";
import { getAnalyticsSummary } from "@/modules/analytics";
import { AnalyticsPanel } from "@/modules/analytics/ui/analytics-panel";
import { listApplications } from "@/modules/applications";
import { ApplicationFilters } from "@/modules/applications/ui/application-filters";
import { ApplicationListEmpty } from "@/modules/applications/ui/application-list-empty";
import { ApplicationTable } from "@/modules/applications/ui/application-table";
import { ExportButton } from "@/modules/data-transfer/ui/export-button";
import { requirePageUser } from "@/modules/identity-access";

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
  await requirePageUser();
  const search = await searchParams;
  const [page, summary] = await Promise.all([
    listApplications(toSearchParams(search)),
    getAnalyticsSummary(),
  ]);
  const filtered = Object.values(search).some(Boolean);
  return (
    <section className="stack page-gap dashboard">
      <div className="hero-row dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span aria-hidden="true" /> 求职进度工作台
          </p>
          <h1>
            让每一次投递，
            <br />
            <span>都有迹可循。</span>
          </h1>
          <p className="lead">
            集中管理岗位、面试阶段和待办跟进，把精力留给真正重要的机会。
          </p>
        </div>
        <div className="actions">
          <ExportButton query={toSearchParams(search).toString()} />
          <Link className="button" href="/applications/new">
            <span aria-hidden="true">＋</span> 新增投递
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
