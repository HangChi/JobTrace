import { requireUser } from "@/modules/identity-access";
import { revalidateTag, unstable_cache } from "next/cache";
import { Problem } from "@/shared/errors/problem";
import { campaignIdSchema, campaignQuerySchema } from "./contracts";
import type { CampaignQuery } from "./ports";
import { PostgresCampaignQuery } from "../infrastructure/postgres-campaign-query";

const repository = () => new PostgresCampaignQuery();
const CAMPAIGN_LIST_CACHE_TAG = "job-market-campaign-list";
const CAMPAIGN_LIST_CACHE_VERSION = "v2-full-details";
const cachedCampaignList = unstable_cache(
  (ownerId: string, input: CampaignQuery) => repository().list(ownerId, input),
  [CAMPAIGN_LIST_CACHE_TAG, CAMPAIGN_LIST_CACHE_VERSION],
  { revalidate: 30, tags: [CAMPAIGN_LIST_CACHE_TAG] },
);

export async function listCampaigns(search: URLSearchParams) {
  const actor = await requireUser();
  const input = campaignQuerySchema.parse(Object.fromEntries(search));
  if (input.favorite) return repository().list(actor.id, input);
  return cachedCampaignList(actor.id, input);
}
export async function getCampaign(id: string) {
  const actor = await requireUser();
  const value = await repository().get(actor.id, campaignIdSchema.parse(id));
  if (!value) throw new Problem("not_found", "没有找到这条招聘记录。", 404);
  return value;
}
export async function setCampaignFavorite(id: string, favorite: boolean) {
  const actor = await requireUser();
  const campaign = await repository().get(actor.id, campaignIdSchema.parse(id));
  if (!campaign) throw new Problem("not_found", "没有找到这条招聘记录。", 404);
  const result = {
    campaignId: id,
    isFavorite: await repository().setFavorite(actor.id, id, favorite),
  };
  revalidateTag(CAMPAIGN_LIST_CACHE_TAG, { expire: 0 });
  return result;
}
