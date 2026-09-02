import { requireUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import { campaignIdSchema, campaignQuerySchema } from "./contracts";
import { PostgresCampaignQuery } from "../infrastructure/postgres-campaign-query";

const repository = () => new PostgresCampaignQuery();
export async function listCampaigns(search: URLSearchParams) {
  const actor = await requireUser();
  const input = campaignQuerySchema.parse(Object.fromEntries(search));
  return repository().list(actor.id, input);
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
  return {
    campaignId: id,
    isFavorite: await repository().setFavorite(actor.id, id, favorite),
  };
}
