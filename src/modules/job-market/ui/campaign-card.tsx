import type { CampaignSummary } from "../domain/entities";
import { FavoriteButton } from "./favorite-button";
import { ApplyAction } from "./apply-action";
import { TrackApplicationDialog } from "./track-application-dialog";

const labels = { open: "有效", stale: "待确认", closed: "已失效" } as const;
export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const date = campaign.lastConfirmedAt
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(campaign.lastConfirmedAt))
    : "未确认";
  return (
    <article className={`campaign-card status-${campaign.status}`}>
      <div className="campaign-company">
        <div>
          <h2>{campaign.company.name}</h2>
          <p>
            {campaign.campaignName ||
              campaign.batchLabel ||
              campaign.recruitmentType ||
              "招聘岗位"}
          </p>
        </div>
        <FavoriteButton
          campaignId={campaign.id}
          initial={campaign.isFavorite}
        />
      </div>
      <dl className="campaign-fields">
        <div>
          <dt>岗位</dt>
          <dd>
            <span>{campaign.positions.slice(0, 3).join("、") || "未提供"}</span>
            {campaign.positionCount > 3 && (
              <details>
                <summary>查看全部 {campaign.positionCount} 个岗位</summary>
                <p>{campaign.positions.join("、")}</p>
              </details>
            )}
          </dd>
        </div>
        <div>
          <dt>地点</dt>
          <dd>
            {campaign.locations
              .slice(0, 4)
              .map((item) => item.name)
              .join("、") || "未提供"}
            {campaign.locations.length > 4 && (
              <details>
                <summary>查看全部地点</summary>
                <p>{campaign.locations.map((item) => item.name).join("、")}</p>
              </details>
            )}
          </dd>
        </div>
      </dl>
      <div className="campaign-meta">
        <span className={`status-pill ${campaign.status}`}>
          {labels[campaign.status]}
        </span>
        <a href={campaign.source.url} target="_blank" rel="noopener noreferrer">
          来源：{campaign.source.name}
        </a>
        <span>最近确认：{date}</span>
      </div>
      <div className="campaign-actions">
        <ApplyAction
          campaignId={campaign.id}
          mode={campaign.applyMode}
          url={campaign.primaryApplyUrl}
          status={campaign.status}
        />
        <TrackApplicationDialog
          campaignId={campaign.id}
          status={campaign.status}
        />
      </div>
    </article>
  );
}
