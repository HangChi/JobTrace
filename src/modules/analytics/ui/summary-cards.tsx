import type { AnalyticsSummary } from "../application/contracts";

export function SummaryCards({ summary }: { summary: AnalyticsSummary }) {
  const cards = [
    ["全部", summary.total],
    ["进行中", summary.active],
    ["未通过", summary.rejected],
    ["Offer", summary.offers],
    ["本周新增", summary.addedThisWeek],
  ];
  return (
    <div className="grid">
      {cards.map(([label, value]) => (
        <article className="panel" key={label}>
          <span className="muted">{label}</span>
          <strong className="metric">{value}</strong>
        </article>
      ))}
    </div>
  );
}
