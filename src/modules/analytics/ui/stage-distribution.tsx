import {
  STAGE_LABELS,
  type RecruitmentStage,
} from "@/modules/applications/domain/catalog";

export function StageDistribution({
  values,
}: {
  values: Record<string, number>;
}) {
  const items = Object.entries(values).filter(([, count]) => count > 0);
  const max = Math.max(...items.map(([, count]) => count), 1);
  return (
    <section className="panel insight-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">PIPELINE</p>
          <h3>阶段分布</h3>
        </div>
        <span className="panel-icon stage-icon" aria-hidden="true" />
      </div>
      {items.length ? (
        <ul className="distribution-list">
          {items.map(([stage, count]) => (
            <li key={stage}>
              <div className="distribution-meta">
                <span>{STAGE_LABELS[stage as RecruitmentStage] ?? stage}</span>
                <strong>{count}</strong>
              </div>
              <span className="progress-track" aria-hidden="true">
                <span
                  style={{ width: `${Math.max((count / max) * 100, 8)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">尚未记录招聘阶段。</p>
      )}
    </section>
  );
}
