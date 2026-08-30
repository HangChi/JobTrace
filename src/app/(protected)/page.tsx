import { listCampaigns } from "@/modules/job-market/application/campaign-service";
import { JobMarketPage } from "@/modules/job-market/ui/job-market-page";
import { requirePageUser } from "@/modules/identity-access";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;
function params(search: Search) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => result.append(key, item));
    else if (value) result.set(key, value);
  }
  return result;
}
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePageUser();
  const query = await searchParams;
  const page = await listCampaigns(params(query));
  return <JobMarketPage page={page} query={query} />;
}
