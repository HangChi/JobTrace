import type { CampaignSummary } from "../domain/entities";
import { FavoriteButton } from "./favorite-button";
import { ApplyAction } from "./apply-action";
import { TrackApplicationDialog } from "./track-application-dialog";

const labels = { open: "有效", stale: "待确认", closed: "已失效" } as const;

function BriefcaseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7m-9 0h12a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm-2 5.5h16M10 12v1.5h4V12" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 10c0 5-8 10-8 10S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14 5h5v5M19 5l-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const date = campaign.lastConfirmedAt
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(campaign.lastConfirmedAt))
    : "未确认";
  return (
    <article className={`campaign-card status-${campaign.status}`}>
      <header className="campaign-company">
        <div className="campaign-company-main">
          <span className="campaign-company-mark" aria-hidden="true">
            {campaign.company.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <div className="campaign-company-copy">
            <div className="campaign-title-line">
              <h2>{campaign.company.name}</h2>
              <span className={`status-pill ${campaign.status}`}>
                {labels[campaign.status]}
              </span>
            </div>
            <p>
              {campaign.campaignName ||
                campaign.batchLabel ||
                campaign.recruitmentType ||
                "招聘岗位"}
            </p>
          </div>
        </div>
        <FavoriteButton
          campaignId={campaign.id}
          initial={campaign.isFavorite}
        />
      </header>
      <div className="campaign-company-tags" aria-label="企业信息">
        {campaign.company.type && <span>{campaign.company.type}</span>}
        {campaign.company.industry && <span>{campaign.company.industry}</span>}
      </div>
      <div className="campaign-counts" aria-label="招聘摘要">
        <span>
          <strong>{campaign.positionCount}</strong> 个岗位
        </span>
        <span>
          <strong>{campaign.locations.length}</strong> 个地点
        </span>
      </div>
      <dl className="campaign-fields">
        <div>
          <dt>
            <BriefcaseIcon />
            岗位
          </dt>
          <dd>
            <ul className="campaign-chip-list">
              {(campaign.positions.slice(0, 4).length
                ? campaign.positions.slice(0, 4)
                : ["未提供"]
              ).map((position) => (
                <li key={position}>{position}</li>
              ))}
            </ul>
            {campaign.positionCount > 4 && (
              <details>
                <summary>展开全部 {campaign.positionCount} 个岗位</summary>
                <ul className="campaign-expanded-list">
                  {campaign.positions.map((position) => (
                    <li key={position}>{position}</li>
                  ))}
                </ul>
              </details>
            )}
          </dd>
        </div>
        <div>
          <dt>
            <LocationIcon />
            地点
          </dt>
          <dd>
            <ul className="campaign-chip-list is-location">
              {(campaign.locations.slice(0, 5).length
                ? campaign.locations.slice(0, 5).map((item) => item.name)
                : ["未提供"]
              ).map((location) => (
                <li key={location}>{location}</li>
              ))}
            </ul>
            {campaign.locations.length > 5 && (
              <details>
                <summary>展开全部 {campaign.locations.length} 个地点</summary>
                <ul className="campaign-expanded-list">
                  {campaign.locations.map((location) => (
                    <li key={location.name}>{location.name}</li>
                  ))}
                </ul>
              </details>
            )}
          </dd>
        </div>
      </dl>
      <footer className="campaign-footer">
        <div className="campaign-meta">
          <a
            href={campaign.source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            官方来源：{campaign.source.name}
            <ExternalLinkIcon />
          </a>
          <span>更新于 {date}</span>
        </div>
        <div className="campaign-actions">
          <TrackApplicationDialog
            campaignId={campaign.id}
            status={campaign.status}
          />
          <ApplyAction
            campaignId={campaign.id}
            mode={campaign.applyMode}
            url={campaign.primaryApplyUrl}
            status={campaign.status}
          />
        </div>
      </footer>
    </article>
  );
}
