import Link from "next/link";
import type { Route } from "next";
import { listInterviews } from "@/modules/interviews";
import { InterviewFilters } from "@/modules/interviews/ui/interview-filters";
import { InterviewList } from "@/modules/interviews/ui/interview-list";
import { requirePageUser } from "@/modules/identity-access";

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
  return (
    <section className="stack page-gap interviews-page">
      <div className="hero-row dashboard-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span aria-hidden="true" /> 面试复盘工作台
          </p>
          <h1>
            把每次面试，<span>变成下一次的准备。</span>
          </h1>
          <p className="lead">
            记录问题、还原回答、明确改进，让经验真正积累下来。
          </p>
        </div>
        <div className="actions">
          <Link className="button" href={"/interviews/new" as Route}>
            记录面经
          </Link>
        </div>
      </div>
      <InterviewFilters query={search} />
      <InterviewList
        page={page}
        nextHref={page.nextCursor ? `/interviews?${next.toString()}` : null}
      />
    </section>
  );
}
