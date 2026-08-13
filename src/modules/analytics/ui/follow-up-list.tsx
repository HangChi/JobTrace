import Link from "next/link";
import type { ApplicationSummary } from "@/modules/applications";

export function FollowUpList({ items }: { items: ApplicationSummary[] }) {
  return (
    <section className="panel insight-panel follow-up-panel">
      <div className="panel-heading">
        <div>
          <h3>需要跟进</h3>
        </div>
        <span className="follow-up-count">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="follow-up-list is-scrollable">
          {items.map((item) => (
            <li key={item.id}>
              <span className="company-avatar" aria-hidden="true">
                {item.companyName.slice(0, 1)}
              </span>
              <div>
                <Link href={`/applications/${item.id}`}>
                  {item.companyName}
                </Link>
                <span className="table-subline">{item.positionName}</span>
              </div>
              <span
                className={`follow-up follow-up-${item.followUpReason ?? "application"}`}
              >
                {item.followUpReason === "timeline"
                  ? `时间线 ${item.followUpDays} 天未更新`
                  : `投递记录 ${item.followUpDays} 天未更新`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="follow-up-empty">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>目前都跟进得很好</strong>
            <p>时间线或投递记录满 15 天未更新会出现在这里。</p>
          </div>
        </div>
      )}
    </section>
  );
}
