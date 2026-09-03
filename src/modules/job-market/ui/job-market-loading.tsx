const rows = Array.from({ length: 8 }, (_, index) => index);

export function JobMarketLoading() {
  return (
    <section
      className="stack page-gap job-market-page job-market-loading"
      aria-busy="true"
      aria-label="正在加载招聘广场"
    >
      <header className="job-market-loading-header">
        <span className="job-market-loading-line is-short" />
        <span className="job-market-loading-line is-title" />
        <span className="job-market-loading-line is-description" />
      </header>
      <div className="panel job-market-loading-filters">
        <span className="job-market-loading-line" />
        <span className="job-market-loading-line" />
        <span className="job-market-loading-line" />
      </div>
      <div className="campaign-table-shell">
        <div className="job-market-loading-table" aria-hidden="true">
          {rows.map((row) => (
            <div className="job-market-loading-row" key={row}>
              <span className="job-market-loading-line is-company" />
              <span className="job-market-loading-line" />
              <span className="job-market-loading-line" />
              <span className="job-market-loading-line is-action" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">招聘信息加载中，请稍候。</span>
    </section>
  );
}
