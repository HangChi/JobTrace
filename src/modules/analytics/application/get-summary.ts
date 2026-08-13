import { fetchAnalyticsSummary } from "../infrastructure/postgres-analytics";

export const getAnalyticsSummary = () => fetchAnalyticsSummary();
