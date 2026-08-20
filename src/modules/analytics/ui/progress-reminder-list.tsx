import Link from "next/link";
import type { Route } from "next";
import { formatCompanyWithCity } from "@/modules/applications/application/display";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import type { ProgressReminder } from "../application/contracts";

function actionFor(item: ProgressReminder) {
  if (item.reviewId) {
    return {
      href: `/interviews/${item.reviewId}`,
      label: "继续完成复盘",
    };
  }
  if (
    item.stage.startsWith("interview_") ||
    item.stage === "hr_interview" ||
    item.stage === "final_interview"
  ) {
    return {
      href: `/interviews/new?applicationId=${item.applicationId}&stageOccurrenceId=${item.stageOccurrenceId}`,
      label: "记录面经",
    };
  }
  return {
    href: `/applications/${item.applicationId}`,
    label: item.stage === "assessment" ? "补充测评结果" : "补充笔试结果",
  };
}

export function ProgressReminderList({ items }: { items: ProgressReminder[] }) {
  if (!items.length) return null;
  return (
    <section
      className="panel progress-reminder-panel"
      aria-labelledby="progress-reminder-title"
    >
      <div className="panel-heading">
        <div>
          <p className="section-kicker">ACTION NEEDED</p>
          <h3 id="progress-reminder-title">待处理进展</h3>
        </div>
        <span className="follow-up-count">{items.length}</span>
      </div>
      <ul className="progress-reminder-list">
        {items.map((item) => {
          const action = actionFor(item);
          const company = formatCompanyWithCity(item.companyName, item.city);
          return (
            <li key={item.id} className="progress-reminder-item">
              <span className="company-avatar" aria-hidden="true">
                {item.companyName.slice(0, 1)}
              </span>
              <span className="progress-reminder-detail">
                <strong>{company}</strong>
                <span className="table-subline">
                  {item.positionName} · {STAGE_LABELS[item.stage]} ·{" "}
                  {item.occurredOn}
                </span>
              </span>
              <Link
                className="button secondary progress-reminder-action"
                href={action.href as Route}
              >
                {action.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
