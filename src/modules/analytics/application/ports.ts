import type { AnalyticsSummary } from "./contracts";

export interface AnalyticsQuery {
  getSummary(): Promise<AnalyticsSummary>;
}
