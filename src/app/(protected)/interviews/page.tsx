import Link from "next/link";
import type { Route } from "next";
import { listInterviews } from "@/modules/interviews";
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
  const page = await listInterviews(params);
  const next = new URLSearchParams(params);
  if (page.nextCursor) next.set("cursor", page.nextCursor);
  const pendingOnPage = page.items.filter(
    (interview) => interview.status !== "completed",
  ).length;
  return (
    <section className="stack page-gap interviews-page">
      <PageHeader
        kicker="面试记录"
        title="面试复盘"
        description="整理面试内容、结论和下一步行动。"
        meta={[
          { label: `共 ${page.total} 次复盘`, tone: "brand" },
          { label: `本页待完善 ${pendingOnPage} 条`, tone: "warning" },
        ]}
        actions={
          <Link className="button" href={"/interviews/new" as Route}>
            新增复盘
          </Link>
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
