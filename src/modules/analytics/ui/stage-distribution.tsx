import {
  RECRUITMENT_STAGES,
  STAGE_LABELS,
  type RecruitmentStage,
} from "@/modules/applications/domain/catalog";

const STAGE_COLORS: Record<RecruitmentStage, string> = {
  screening: "#3182a0",
  assessment: "#7a64bd",
  written_test: "#d48a24",
  interview_1: "#0d9b84",
  interview_2: "#087f73",
  interview_3: "#3865a8",
  hr_interview: "#c45f82",
  final_interview: "#6e8f24",
};

export function StageDistribution({
  values,
}: {
  values: Partial<Record<RecruitmentStage, number>>;
}) {
  const items = RECRUITMENT_STAGES.flatMap((stage) => {
    const count = values[stage] ?? 0;
    return count > 0 ? [[stage, count] as const] : [];
  });
  const total = items.reduce((sum, [, count]) => sum + count, 0);
  const max = Math.max(...items.map(([, count]) => count), 1);
  const ringSegments = items.map(([stage, count], index) => {
    const start =
      (items
        .slice(0, index)
        .reduce((sum, [, previousCount]) => sum + previousCount, 0) /
        total) *
      100;
    const end = start + (count / total) * 100;
    return `${STAGE_COLORS[stage]} ${start}% ${end}%`;
  });
  return (
    <section className="panel insight-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">招聘流程</p>
          <h3>阶段分布</h3>
        </div>
      </div>
      {items.length ? (
        <div className="distribution-layout">
          <div
            className="pipeline-total"
            aria-label={`共 ${total} 次阶段记录`}
            style={{
              background: `radial-gradient(circle at center, white 55%, transparent 57%), conic-gradient(${ringSegments.join(", ")})`,
            }}
          >
            <strong>{total}</strong>
            <span>阶段记录</span>
          </div>
          <ul className="distribution-list is-scrollable">
            {items.map(([stage, count]) => (
              <li key={stage} className={`stage-${stage}`}>
                <div className="distribution-meta">
                  <span>
                    <i aria-hidden="true" />
                    {STAGE_LABELS[stage]}
                  </span>
                  <strong>
                    {count}
                    <small> 次</small>
                  </strong>
                </div>
                <span className="progress-track" aria-hidden="true">
                  <span
                    style={{ width: `${Math.max((count / max) * 100, 10)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">尚未记录招聘阶段。</p>
      )}
    </section>
  );
}
