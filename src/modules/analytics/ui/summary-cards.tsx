import type { AnalyticsSummary } from "../application/contracts";

export function SummaryCards({ summary }: { summary: AnalyticsSummary }) {
  const cards = [
    ["全部投递", summary.total, "total"],
    ["正在进行", summary.active, "active"],
    ["已获 Offer", summary.offers, "offer"],
    ["本周新增", summary.addedThisWeek, "week"],
    ["未通过", summary.rejected, "rejected"],
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
