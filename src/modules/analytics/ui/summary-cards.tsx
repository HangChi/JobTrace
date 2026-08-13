import type { AnalyticsSummary } from "../application/contracts";

export function SummaryCards({ summary }: { summary: AnalyticsSummary }) {
  const cards = [
    ["全部投递", summary.total, "total"],
    ["已投递", summary.submitted, "active"],
    ["Offer", summary.offers, "offer"],
    ["本周新增", summary.addedThisWeek, "week"],
    ["拒绝", summary.refused, "rejected"],
  ];
  return (
    <div className="summary-grid">
      {cards.map(([label, value, tone]) => (
        <article className={`panel summary-card summary-${tone}`} key={label}>
          <span className="metric-icon" aria-hidden="true" />
          <div>
            <strong className="metric">{value}</strong>
            <span className="metric-label">{label}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
