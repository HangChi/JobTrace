import type { AdminOperationalSummary } from "../application/contracts";

const number = new Intl.NumberFormat("zh-CN");

export function AdminSummary({
  summary,
}: {
  summary: AdminOperationalSummary;
}) {
  return (
    <div className="admin-overview stack">
      {summary.counts.status === "available" ? (
        <section className="summary-grid" aria-label="平台总览">
          {[
            ["用户", summary.counts.value.users],
            ["有效用户", summary.counts.value.activeUsers],
            ["已禁用", summary.counts.value.disabledUsers],
            ["有效管理员", summary.counts.value.administrators],
            ["全部投递", summary.counts.value.applications],
            ["全部面经", summary.counts.value.interviews],
          ].map(([label, value]) => (
            <article className="panel" key={label}>
              <strong>{number.format(Number(value))}</strong>
              <span>{label}</span>
            </article>
          ))}
        </section>
      ) : (
        <p className="panel error" role="alert">
          平台总量暂时无法取得，请稍后重试。
        </p>
      )}

      <section className="panel stack" aria-labelledby="admin-activity-title">
        <div>
          <p className="eyebrow">近期活动</p>
          <h2 id="admin-activity-title">注册与活跃趋势</h2>
          <p className="muted">{summary.activityDefinition}</p>
        </div>
        {summary.activity.status === "available" ? (
          <>
            <dl className="admin-window-grid">
              <div>
                <dt>近 7 天新增</dt>
                <dd>{summary.activity.windows.registered7d}</dd>
              </div>
              <div>
                <dt>近 7 天活跃</dt>
                <dd>{summary.activity.windows.active7d}</dd>
              </div>
              <div>
                <dt>近 30 天新增</dt>
                <dd>{summary.activity.windows.registered30d}</dd>
              </div>
              <div>
                <dt>近 30 天活跃</dt>
                <dd>{summary.activity.windows.active30d}</dd>
              </div>
            </dl>
            <details>
              <summary>查看最近 30 天明细</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>新增</th>
                      <th>活跃</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.activity.dailyTrend.map((point) => (
                      <tr key={point.date}>
                        <td>{point.date}</td>
                        <td>{point.registeredUsers}</td>
                        <td>{point.activeUsers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className="error" role="alert">
            活动趋势暂时无法取得；未知值未按零计算。
          </p>
        )}
        <p className="muted">
          生成时间：
          {new Date(summary.generatedAt).toLocaleString("zh-CN", {
            timeZone: summary.timeZone,
          })}
          （{summary.timeZone}）
        </p>
      </section>
    </div>
  );
}
