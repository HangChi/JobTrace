export default function AnalyticsLoading() {
  return (
    <section
      className="stack page-gap analytics-report-page"
      aria-busy="true"
      aria-label="正在加载求职分析"
    >
      <div className="analytics-report-hero analytics-skeleton" />
      <div className="panel analytics-filter-skeleton analytics-skeleton" />
      <div className="analytics-report-metrics">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            className="panel report-metric-card analytics-skeleton"
            key={index}
          />
        ))}
      </div>
    </section>
  );
}
