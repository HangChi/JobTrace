import { fetchAnalyticsSummary } from "../infrastructure/postgres-analytics";
import { requireUser } from "@/modules/identity-access";

export async function getAnalyticsSummary() {
  const actor = await requireUser();
  return fetchAnalyticsSummary(actor.id);
}
