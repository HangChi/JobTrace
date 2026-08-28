import type { AnalyticsTrendPoint } from "../application/contracts";

const SERIES = [
  { key: "applications", label: "投递", className: "trend-applications" },
  { key: "interviewed", label: "获得面试", className: "trend-interviewed" },
  { key: "offers", label: "获得 Offer", className: "trend-offers" },
] as const;

export function ApplicationTrendChart({
  points,
}: {
  points: AnalyticsTrendPoint[];
}) {
  const width = 820;
  const height = 270;
  const padding = 38;
  const max = Math.max(
    1,
    ...points.flatMap((point) => [
      point.applications,
      point.interviewed,
      point.offers,
    ]),
  );
  const x = (index: number) =>
    points.length <= 1
      ? width / 2
      : padding + (index / (points.length - 1)) * (width - padding * 2);
  const y = (value: number) =>
    height - padding - (value / max) * (height - padding * 2);
  const path = (key: (typeof SERIES)[number]["key"]) =>
    points
      .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point[key])}`)
      .join(" ");

  return (
    <section
      className="panel analytics-report-panel trend-panel"
      aria-labelledby="trend-title"
    >
      <div className="analytics-report-panel-heading">
        <div>
          <h2 id="trend-title">投递趋势</h2>
        </div>
        <span>{points.length ? `${points.length} 个时间段` : "暂无数据"}</span>
      </div>
      {points.length ? (
        <>
          <div className="trend-legend" aria-label="图例">
            {SERIES.map((series) => (
              <span key={series.key} className={series.className}>
                <i aria-hidden="true" />
                {series.label}
              </span>
            ))}
          </div>
          <div className="trend-chart-scroll">
            <svg
              className="trend-chart"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="按投递周期展示投递、获得面试和获得 Offer 数量的趋势图"
            >
              {[0, 0.5, 1].map((part) => (
                <line
                  key={part}
                  x1={padding}
                  x2={width - padding}
                  y1={y(max * part)}
                  y2={y(max * part)}
                  className="trend-gridline"
                />
              ))}
              {SERIES.map((series) => (
                <g key={series.key} className={series.className}>
                  <path d={path(series.key)} className="trend-line" />
                  {points.map((point, index) => (
                    <g
                      key={point.periodStart}
                      tabIndex={0}
                      role="img"
                      aria-label={`${point.label}，${series.label} ${point[series.key]} 条`}
                    >
                      <circle cx={x(index)} cy={y(point[series.key])} r="5" />
                      <title>{`${point.label}：${series.label} ${point[series.key]} 条`}</title>
                    </g>
                  ))}
                </g>
              ))}
              {points.map((point, index) => (
                <text
                  key={point.periodStart}
                  x={x(index)}
                  y={height - 10}
                  textAnchor="middle"
                  className="trend-axis-label"
                >
                  {point.label}
                </text>
              ))}
            </svg>
          </div>
          <details className="analytics-data-details">
            <summary>查看趋势数据表</summary>
            <div className="analytics-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>周期</th>
                    <th>投递</th>
                    <th>获得面试</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.periodStart}>
                      <td>{point.label}</td>
                      <td>{point.applications}</td>
                      <td>{point.interviewed}</td>
                      <td>{point.offers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="analytics-panel-empty">当前范围内没有投递趋势数据。</p>
      )}
    </section>
  );
}
