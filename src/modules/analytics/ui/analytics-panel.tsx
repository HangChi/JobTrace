import type { AnalyticsSummary } from "../application/contracts";
import { FollowUpList } from "./follow-up-list";
import { ProgressReminderList } from "./progress-reminder-list";
import { StageDistribution } from "./stage-distribution";
import { SummaryCards } from "./summary-cards";

export function AnalyticsPanel({ summary }: { summary: AnalyticsSummary }) {
  return (
    <section
      className="stack analytics-section"
      aria-labelledby="analytics-title"
    >
      <div className="section-heading section-heading-copy">
        <div>
          <p className="section-kicker">OVERVIEW</p>
          <h2 id="analytics-title">求职概览</h2>
        </div>
        <p className="muted">聚焦当前进展，及时处理待跟进机会</p>
      </div>
      <SummaryCards summary={summary} />
      <ProgressReminderList items={summary.progressReminders} />
      <div className="analytics-grid">
        <StageDistribution values={summary.stageDistribution} />
        <FollowUpList items={summary.followUps} />
      </div>
    </section>
  );
}
