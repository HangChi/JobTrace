import type { AnalyticsSummary } from "../application/contracts";
import { FollowUpList } from "./follow-up-list";
import { ProgressReminderList } from "./progress-reminder-list";
import type { ReminderPreferences, ReminderSummary } from "@/modules/reminders";
import { ReminderPanel } from "@/modules/reminders/ui/reminder-panel";
import { StageDistribution } from "./stage-distribution";
import { SummaryCards } from "./summary-cards";

export function AnalyticsPanel({
  summary,
  reminderSummary,
  reminderPreferences,
}: {
  summary: AnalyticsSummary;
  reminderSummary?: ReminderSummary;
  reminderPreferences: ReminderPreferences;
}) {
  return (
    <section
      className="stack analytics-section"
      aria-labelledby="analytics-title"
    >
      <div className="section-heading section-heading-copy">
        <div>
          <h2 id="analytics-title">求职概览</h2>
        </div>
        <p className="muted">当前进展与待办</p>
      </div>
      <SummaryCards summary={summary} />
      {reminderPreferences.homeEnabled &&
        reminderPreferences.homeView === "scheduled" &&
        reminderSummary && (
          <ReminderPanel
            initialSummary={reminderSummary}
            preferences={reminderPreferences}
          />
        )}
      {reminderPreferences.homeEnabled &&
        reminderPreferences.homeView === "suggestions" && (
          <ProgressReminderList items={summary.progressReminders} />
        )}
      <div className="analytics-grid">
        <StageDistribution values={summary.stageDistribution} />
        <FollowUpList items={summary.followUps} />
      </div>
    </section>
  );
}
