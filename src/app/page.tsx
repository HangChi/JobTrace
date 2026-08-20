import { getAnalyticsSummary } from "@/modules/analytics";
import { listApplications } from "@/modules/applications";
import { ApplicationDashboard } from "@/modules/applications/ui/application-dashboard";
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
  const filtered = [
    search.q,
    search.status,
    search.type,
    search.stage,
    search.city,
    search.appliedFrom,
    search.appliedTo,
  ].some(Boolean);
  const exportSearch = { ...search };
  delete exportSearch.cursor;
  delete exportSearch.history;
  delete exportSearch.page;
  delete exportSearch.limit;
  const listQuery = toSearchParams(listSearch).toString();
  return (
    <ApplicationDashboard
      initialPage={page}
      initialSummary={summary}
      query={search}
      filtered={filtered}
      listQuery={listQuery}
      exportQuery={toSearchParams(exportSearch).toString()}
    />
  );
}
