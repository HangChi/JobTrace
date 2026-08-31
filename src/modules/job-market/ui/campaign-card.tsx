import type { CampaignSummary } from "../domain/entities";
import { FavoriteButton } from "./favorite-button";
import { ApplyAction } from "./apply-action";
import { TrackApplicationDialog } from "./track-application-dialog";

const labels = { open: "有效", stale: "待确认", closed: "已失效" } as const;

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14 5h5v5M19 5l-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function CompactValues({
  values,
  count,
  countLabel,
  emptyLabel,
}: {
  values: string[];
  count: number;
  countLabel: string;
  emptyLabel: string;
}) {
  if (!values.length)
    return <span className="campaign-table-empty">{emptyLabel}</span>;
  const preview = values.slice(0, 2);
  const remaining = Math.max(0, count - preview.length);
  const valueList = (
    <span className="campaign-table-values">
      {preview.map((value) => (
        <span key={value} title={value}>
          {value}
        </span>
      ))}
    </span>
  );
  if (!remaining) return valueList;
  return (
    <details className="campaign-table-details">
      <summary>
        {valueList}
        <span className="campaign-more-count">
          +{remaining} {countLabel}
        </span>
      </summary>
      <ul>
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </details>
  );
}

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const isDirectory = campaign.listingKind === "recruitment_directory";
  const date = campaign.lastConfirmedAt
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(campaign.lastConfirmedAt))
    : null;

  return (
    <tr
      className={`campaign-table-row status-${campaign.status}${isDirectory ? " is-directory" : ""}`}
    >
      <th scope="row" className="campaign-company-cell">
        <div className="campaign-company-compact">
          <span className="campaign-company-mark" aria-hidden="true">
            {campaign.company.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="campaign-company-copy">
            <span className="campaign-title-line">
              <strong>{campaign.company.name}</strong>
              <span className={`status-pill ${campaign.status}`}>
                {isDirectory ? "公众号" : labels[campaign.status]}
              </span>
            </span>
            <span className="campaign-company-meta">
              {[campaign.company.type, campaign.company.industry]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </div>
      </th>
      <td className="campaign-position-cell">
        {isDirectory ? (
          <span className="campaign-directory-cell">
            <strong>公众号发布</strong>
            <span>岗位以最新推文为准</span>
          </span>
        ) : (
          <>
            <span className="campaign-cell-count">
              {campaign.positionCount} 个岗位
            </span>
            <CompactValues
              values={campaign.positions}
              count={campaign.positionCount}
              countLabel="个"
              emptyLabel="岗位未提供"
            />
          </>
        )}
      </td>
      <td className="campaign-location-cell">
        {isDirectory ? (
          <span className="campaign-table-empty">以公众号为准</span>
        ) : (
          <>
            <span className="campaign-cell-count">
              {campaign.locations.length} 个地点
            </span>
            <CompactValues
              values={campaign.locations.map((location) => location.name)}
              count={campaign.locations.length}
              countLabel="个"
              emptyLabel="地点未提供"
            />
          </>
        )}
      </td>
      <td className="campaign-source-cell">
        <span className="campaign-source-type">
          {campaign.campaignName ||
            campaign.batchLabel ||
            campaign.recruitmentType ||
            "招聘岗位"}
        </span>
        <a href={campaign.source.url} target="_blank" rel="noopener noreferrer">
          {isDirectory ? "公众号搜索" : campaign.source.name}
          <ExternalLinkIcon />
        </a>
        <span className="campaign-source-date">
          {isDirectory
            ? "目录入口 · 非自动同步"
            : date
              ? `更新 ${date}`
              : "尚未确认"}
        </span>
      </td>
      <td className="campaign-action-cell">
        <div className="campaign-row-actions">
          <FavoriteButton
            campaignId={campaign.id}
            initial={campaign.isFavorite}
          />
          {!isDirectory && (
            <TrackApplicationDialog
              campaignId={campaign.id}
              status={campaign.status}
            />
          )}
          <ApplyAction
            campaignId={campaign.id}
            mode={campaign.applyMode}
            url={campaign.primaryApplyUrl}
            status={campaign.status}
            label={isDirectory ? "查看公众号" : "立即投递"}
          />
        </div>
      </td>
    </tr>
  );
}
