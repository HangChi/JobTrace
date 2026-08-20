"use client";

import { useState } from "react";
import type { ApplicationSummary } from "@/modules/applications";
import { ApplicationDetailDialog } from "@/modules/applications/ui/application-detail-dialog";
import { formatCompanyWithCity } from "@/modules/applications/application/display";

export function FollowUpList({ items }: { items: ApplicationSummary[] }) {
  const [selected, setSelected] = useState<ApplicationSummary | null>(null);
  return (
    <>
      <section className="panel insight-panel follow-up-panel">
        <div className="panel-heading">
          <div>
            <h3>需要跟进</h3>
          </div>
          <span className="follow-up-count">{items.length}</span>
        </div>
        {items.length ? (
          <ul className="follow-up-list is-scrollable">
            {items.map((item) => {
              const companyDisplayName = formatCompanyWithCity(
                item.companyName,
                item.city,
              );
              return (
                <li key={item.id}>
                  <button
                    className="follow-up-detail-trigger"
                    type="button"
                    onClick={() => setSelected(item)}
                    aria-label={`查看 ${companyDisplayName} ${item.positionName} 详情`}
                  >
                    <span className="company-avatar" aria-hidden="true">
                      {item.companyName.slice(0, 1)}
                    </span>
                    <span className="follow-up-company">
                      <strong>{companyDisplayName}</strong>
                      <span className="table-subline">{item.positionName}</span>
                    </span>
                    <span
                      className={`follow-up follow-up-${item.followUpReason ?? "application"}`}
                    >
                      {item.followUpReason === "timeline"
                        ? `时间线 ${item.followUpDays} 天未更新`
                        : `投递记录 ${item.followUpDays} 天未更新`}
                    </span>
                  </button>
                </li>
              );
            })}
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
      <ApplicationDetailDialog
        application={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
