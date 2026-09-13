import Link from "next/link";
import type { Route } from "next";
import { listPublicInterviews } from "@/modules/interviews";
import { PublicInterviewFilters } from "@/modules/interviews/ui/public-interview-filters";
import { PublicInterviewList } from "@/modules/interviews/ui/public-interview-list";
import { requirePageUser } from "@/modules/identity-access";
import { toSearchParams } from "@/shared/url/search-params";

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
  const next = new URLSearchParams();
  const companyQuery = params.get("q");
  if (companyQuery) next.set("q", companyQuery);
  if (page.nextCursor) next.set("cursor", page.nextCursor);
  return (
    <section className="interview-square-page">
      <div className="public-feed-toolbar">
        <PublicInterviewFilters query={search} />
        <Link className="public-mine-link" href={"/interviews/mine" as Route}>
          我的面经
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m6 3.5 4.5 4.5L6 12.5" />
          </svg>
        </Link>
      </div>
      <PublicInterviewList
        page={page}
        nextHref={page.nextCursor ? `/interviews?${next.toString()}` : null}
      />
    </section>
  );
}
