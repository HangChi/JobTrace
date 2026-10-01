import { fetchAnalyticsSummary } from "../infrastructure/postgres-analytics";
import { requireUser } from "@/modules/identity-access";

export async function getAnalyticsSummary() {
  const actor = await requireUser();
  return getAnalyticsSummaryForOwner(actor.id);
}

export async function getAnalyticsSummaryForOwner(ownerId: string) {
  return fetchAnalyticsSummary(ownerId);
}
