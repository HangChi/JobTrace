import {
  formatCompanyWithCity,
  listApplications,
} from "@/modules/applications";
import { listInterviews } from "@/modules/interviews";
import { NewInterviewDialog } from "@/modules/interviews/ui/interview-dialogs";
import { InterviewFilters } from "@/modules/interviews/ui/interview-filters";
import { InterviewList } from "@/modules/interviews/ui/interview-list";
import { requirePageUser } from "@/modules/identity-access";
import { PageHeader } from "@/shared/ui/page-header";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;
function paramsFrom(search: Search) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value) params.set(key, value);
  }
  return params;
}
export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePageUser();
  const search = await searchParams;
  const params = paramsFrom(search);
  const [page, applicationsPage] = await Promise.all([
    listInterviews(params),
    listApplications(new URLSearchParams({ limit: "100" })),
  ]);
  const next = new URLSearchParams(params);
  if (page.nextCursor) next.set("cursor", page.nextCursor);
  return (
    <section className="stack page-gap interviews-page">
      <PageHeader
        tone="interviews"
        kicker="面试记录"
        title="面试复盘"
        description="整理面试内容、结论和下一步行动。"
        actions={
          <NewInterviewDialog
            applications={applicationsPage.items.map((item) => ({
              id: item.id,
              label: `${formatCompanyWithCity(item.companyName, item.city)} · ${item.positionName}`,
              appliedDate: item.appliedDate,
            }))}
          />
        }
      />
      <InterviewFilters query={search} />
      <InterviewList
        page={page}
        nextHref={page.nextCursor ? `/interviews?${next.toString()}` : null}
      />
    </section>
  );
}
