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
  return (
    <section className="panel">
      <h3>阶段分布</h3>
      {items.length ? (
        <ul className="distribution-list">
          {items.map(([stage, count]) => (
            <li key={stage}>
              <span>{STAGE_LABELS[stage as RecruitmentStage] ?? stage}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">尚未记录招聘阶段。</p>
      )}
    </section>
  );
}
