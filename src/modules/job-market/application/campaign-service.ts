import { requireUser } from "@/modules/identity-access";
import { revalidateTag, unstable_cache } from "next/cache";
import { Problem } from "@/shared/errors/problem";
import { campaignIdSchema, campaignQuerySchema } from "./contracts";
import type { CampaignQuery } from "./ports";
import { PostgresCampaignQuery } from "../infrastructure/postgres-campaign-query";

const repository = () => new PostgresCampaignQuery();
const CAMPAIGN_LIST_CACHE_TAG = "job-market-campaign-list";
const CAMPAIGN_LIST_CACHE_VERSION = "v3-owner-scoped";
const campaignListCacheTag = (ownerId: string) =>
  `${CAMPAIGN_LIST_CACHE_TAG}:${ownerId}`;

function cachedCampaignList(ownerId: string, input: CampaignQuery) {
  return unstable_cache(
    () => repository().list(ownerId, input),
    [
      CAMPAIGN_LIST_CACHE_TAG,
      CAMPAIGN_LIST_CACHE_VERSION,
      ownerId,
      JSON.stringify(input),
    ],
    {
      revalidate: 30,
      tags: [CAMPAIGN_LIST_CACHE_TAG, campaignListCacheTag(ownerId)],
    },
  )();
}

export function invalidateCampaignLists() {
  revalidateTag(CAMPAIGN_LIST_CACHE_TAG, { expire: 0 });
}

export async function listCampaigns(search: URLSearchParams) {
  const actor = await requireUser();
  const input = campaignQuerySchema.parse(Object.fromEntries(search));
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
  const campaignId = campaignIdSchema.parse(id);
  const isFavorite = await repository().setFavorite(
    actor.id,
    campaignId,
    favorite,
  );
  if (isFavorite === null)
    throw new Problem("not_found", "没有找到这条招聘记录。", 404);
  const result = {
    campaignId,
    isFavorite,
  };
  revalidateTag(campaignListCacheTag(actor.id), { expire: 0 });
  return result;
}
