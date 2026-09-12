import { Suspense } from "react";
import { listCampaigns } from "@/modules/job-market/application/campaign-service";
import { JobMarketLoading } from "@/modules/job-market/ui/job-market-loading";
import { JobMarketPage } from "@/modules/job-market/ui/job-market-page";
import { requirePageUser } from "@/modules/identity-access";
import { toSearchParams } from "@/shared/url/search-params";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;
async function JobMarketContent({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePageUser();
  const query = await searchParams;
  const page = await listCampaigns(toSearchParams(query));
  return <JobMarketPage page={page} query={query} />;
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<JobMarketLoading />}>
      <JobMarketContent searchParams={searchParams} />
    </Suspense>
  );
}
