import { listPublicInterviews } from "@/modules/interviews";
import { PublicInterviewFilters } from "@/modules/interviews/ui/public-interview-filters";
import { PublicInterviewList } from "@/modules/interviews/ui/public-interview-list";
import { requirePageUser } from "@/modules/identity-access";
import { toSearchParams } from "@/shared/url/search-params";
import { PageHeader } from "@/shared/ui/page-header";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;

export default async function InterviewSquarePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePageUser();
  const search = await searchParams;
  const params = toSearchParams(search);
  const page = await listPublicInterviews(params);
  const next = new URLSearchParams(params);
  if (page.nextCursor) next.set("cursor", page.nextCursor);
  return (
    <section className="stack page-gap interviews-page">
      <PageHeader
        tone="interviews"
        kicker="经验共享"
        title="面经广场"
        description="浏览求职者主动公开的脱敏面试复盘。"
      />
      <PublicInterviewFilters query={search} />
      <PublicInterviewList
        page={page}
        nextHref={page.nextCursor ? `/interviews?${next.toString()}` : null}
      />
    </section>
  );
}
