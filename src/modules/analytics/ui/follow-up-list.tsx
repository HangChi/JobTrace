import Link from "next/link";
import type { ApplicationSummary } from "@/modules/applications";

export function FollowUpList({ items }: { items: ApplicationSummary[] }) {
  if (!items.length) return null;
  return (
    <section className="panel">
      <h3>需要跟进</h3>
      <ul className="distribution-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/applications/${item.id}`}>
              {item.companyName} · {item.positionName}
            </Link>
            <span className="follow-up">{item.followUpDays} 天未更新</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
