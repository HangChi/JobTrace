import Link from "next/link";
import type { ApplicationPage } from "../application/contracts";
import { STATUS_LABELS } from "../domain/catalog";

export function ApplicationTable({ page }: { page: ApplicationPage }) {
  return (
    <section
      className="panel table-wrap"
      aria-labelledby="application-list-title"
    >
      <div className="section-heading">
        <h2 id="application-list-title">投递记录</h2>
        <span className="muted">本页 {page.items.length} 条</span>
      </div>
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
              <td>
                <strong>{item.companyName}</strong>
                <span className="table-subline">{item.positionName}</span>
              </td>
              <td>
                <span className="badge">{STATUS_LABELS[item.status]}</span>
              </td>
              <td>{item.appliedDate}</td>
              <td>
                {item.latestDate}
                {item.needsFollowUp && (
                  <span className="follow-up">
                    已 {item.followUpDays} 天未更新
                  </span>
                )}
              </td>
              <td>
                <Link href={`/applications/${item.id}`}>查看详情</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {page.nextCursor && (
        <p className="muted">还有更多记录，请缩小筛选范围查看。</p>
      )}
    </section>
  );
}
