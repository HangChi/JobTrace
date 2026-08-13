import Link from "next/link";
import type { ApplicationPage } from "../application/contracts";
import { STATUS_LABELS } from "../domain/catalog";

export function ApplicationTable({ page }: { page: ApplicationPage }) {
  return (
    <section
      className="panel application-list-panel"
      aria-labelledby="application-list-title"
    >
      <div className="section-heading">
        <h2 id="application-list-title">投递记录</h2>
        <span className="muted">本页 {page.items.length} 条</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>公司与岗位</th>
              <th>状态</th>
              <th>投递日期</th>
              <th>最近进展</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => (
              <tr key={item.id}>
                <td data-label="公司与岗位">
                  <strong>{item.companyName}</strong>
                  <span className="table-subline">{item.positionName}</span>
                </td>
                <td data-label="状态">
                  <span className={`status-badge status-${item.status}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </td>
                <td data-label="投递日期">{item.appliedDate}</td>
                <td data-label="最近进展">
                  {item.latestDate}
                  {item.needsFollowUp && (
                    <span className="follow-up">
                      已 {item.followUpDays} 天未更新
                    </span>
                  )}
                </td>
                <td data-label="操作">
                  <Link
                    className="detail-link"
                    href={`/applications/${item.id}`}
                  >
                    查看详情 <span aria-hidden="true">→</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {page.nextCursor && (
        <p className="muted">还有更多记录，请缩小筛选范围查看。</p>
      )}
    </section>
  );
}
