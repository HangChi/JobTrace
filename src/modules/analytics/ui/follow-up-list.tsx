import Link from "next/link";
import type { ApplicationSummary } from "@/modules/applications";

export function FollowUpList({ items }: { items: ApplicationSummary[] }) {
  if (!items.length) return null;
  return (
    <section className="panel insight-panel follow-up-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">NEXT ACTION</p>
          <h3>需要跟进</h3>
        </div>
        <span className="follow-up-count">{items.length}</span>
      </div>
      <ul className="follow-up-list">
        {items.map((item) => (
          <li key={item.id}>
            <span className="company-avatar" aria-hidden="true">
              {item.companyName.slice(0, 1)}
            </span>
            <div>
              <Link href={`/applications/${item.id}`}>{item.companyName}</Link>
              <span className="table-subline">{item.positionName}</span>
            </div>
            <span className="follow-up">{item.followUpDays} 天</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
