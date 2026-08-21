import type {
  AnalyticsReport,
  MetricComparison,
} from "../application/contracts";

function comparisonText(metric: MetricComparison) {
  if (metric.delta === null) return "无可比周期";
  const suffix = metric.deltaKind === "percentage_point" ? " 个百分点" : "%";
  if (metric.delta === 0) return "与上一周期持平";
  return `较上一周期${metric.delta > 0 ? "增加" : "减少"} ${Math.abs(metric.delta)}${suffix}`;
}

export function ReportMetricCards({ report }: { report: AnalyticsReport }) {
  const cards: Array<{
    label: string;
    metric: MetricComparison;
    format: (value: number | null) => string;
    tone: string;
  }> = [
    {
      label: "投递数量",
      metric: report.metrics.applications,
      format: (v) => `${v ?? 0}`,
      tone: "total",
    },
    {
      label: "获得面试率",
      metric: report.metrics.interviewRate,
      format: (v) => (v === null ? "—" : `${v}%`),
      tone: "active",
    },
    {
      label: "总体 Offer 率",
      metric: report.metrics.offerRate,
      format: (v) => (v === null ? "—" : `${v}%`),
      tone: "offer",
    },
    {
      label: "首次面试等待",
      metric: report.metrics.medianDaysToFirstInterview,
      format: (v) => (v === null ? "—" : `${v} 天`),
      tone: "week",
    },
    {
      label: "面经完成率",
      metric: report.metrics.reviewCompletionRate,
      format: (v) => (v === null ? "—" : `${v}%`),
      tone: "review",
    },
  ];
  return (
    <div className="analytics-report-metrics">
      {cards.map((card) => (
        <article
          className={`panel report-metric-card report-metric-${card.tone}`}
          key={card.label}
        >
          <span className="report-metric-accent" aria-hidden="true" />
          <span className="report-metric-label">{card.label}</span>
          <strong>{card.format(card.metric.value)}</strong>
          <small>{comparisonText(card.metric)}</small>
        </article>
      ))}
    </div>
  );
}
