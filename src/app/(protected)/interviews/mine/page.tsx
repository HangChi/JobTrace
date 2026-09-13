import {
  formatCompanyWithCity,
  listApplicationOptions,
} from "@/modules/applications";
import { listInterviews } from "@/modules/interviews";
import { NewInterviewDialog } from "@/modules/interviews/ui/interview-dialogs";
import { InterviewFilters } from "@/modules/interviews/ui/interview-filters";
import { InterviewList } from "@/modules/interviews/ui/interview-list";
import { requirePageUser } from "@/modules/identity-access";
import { toSearchParams } from "@/shared/url/search-params";
import { PageHeader } from "@/shared/ui/page-header";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;

export default async function MyInterviewsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePageUser();
  const search = await searchParams;
  const params = toSearchParams(search);
  const [page, applicationOptions] = await Promise.all([
    listInterviews(params),
    listApplicationOptions(),
  ]);
  const next = new URLSearchParams(params);
  if (page.nextCursor) next.set("cursor", page.nextCursor);
  return (
    <section className="stack page-gap interviews-page">
      <PageHeader
        tone="interviews"
        kicker="面试记录"
        title="个人面经"
        description="管理自己的面试记录、复盘状态和分享设置。"
        actions={
          <NewInterviewDialog
            applications={applicationOptions.map((item) => ({
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
        nextHref={
          page.nextCursor ? `/interviews/mine?${next.toString()}` : null
        }
      />
    </section>
  );
}
