import { getAnalyticsSummary } from "@/modules/analytics";
import { AnalyticsPanel } from "@/modules/analytics/ui/analytics-panel";
import { listApplications } from "@/modules/applications";
import { ApplicationFilters } from "@/modules/applications/ui/application-filters";
import { ApplicationListEmpty } from "@/modules/applications/ui/application-list-empty";
import { ApplicationTable } from "@/modules/applications/ui/application-table";
import { NewApplicationDialog } from "@/modules/applications/ui/application-dialogs";
import { ExportButton } from "@/modules/data-transfer/ui/export-button";
import { requirePageUser } from "@/modules/identity-access";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const PAGE_SIZES = ["10", "20", "50", "100"] as const;

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
  const pageSize =
    typeof search.limit === "string" &&
    PAGE_SIZES.includes(search.limit as (typeof PAGE_SIZES)[number])
      ? search.limit
      : "10";
  const listSearch = { ...search, limit: pageSize };
  const [page, summary] = await Promise.all([
    listApplications(toSearchParams(listSearch)),
    getAnalyticsSummary(),
  ]);
  const filtered = [search.q, search.status, search.sort].some(Boolean);
  const exportSearch = { ...search };
  delete exportSearch.cursor;
  delete exportSearch.history;
  delete exportSearch.page;
  delete exportSearch.limit;
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
          <ExportButton query={toSearchParams(exportSearch).toString()} />
          <NewApplicationDialog />
        </div>
      </div>
      <AnalyticsPanel summary={summary} />
      <ApplicationFilters query={search} />
      {page.items.length ? (
        <ApplicationTable page={page} query={search} />
      ) : (
        <ApplicationListEmpty filtered={filtered} />
      )}
    </section>
  );
}
