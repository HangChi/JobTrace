import type { AnalyticsSummary } from "../application/contracts";
import { FollowUpList } from "./follow-up-list";
import { StageDistribution } from "./stage-distribution";
import { SummaryCards } from "./summary-cards";

export function AnalyticsPanel({ summary }: { summary: AnalyticsSummary }) {
  return (
    <section className="stack" aria-labelledby="analytics-title">
      <h2 id="analytics-title">求职概览</h2>
      <SummaryCards summary={summary} />
      <div className="analytics-grid">
        <StageDistribution values={summary.stageDistribution} />
        <FollowUpList items={summary.followUps} />
      </div>
    </section>
  );
}
