import { STAGE_LABELS } from "../domain/catalog";
import type { ApplicationDetail } from "../application/contracts";
export function ApplicationHistory({
  application,
}: {
  application: ApplicationDetail;
}) {
  return (
    <section className="panel">
      <h2>进展历史</h2>
      {application.events.length === 0 ? (
        <p className="muted">暂无变更记录。</p>
      ) : (
        <ol>
          {application.events.map((event) => (
            <li key={event.id}>
              <time>{event.occurredOn}</time> · {event.type}
            </li>
          ))}
        </ol>
      )}
      <h3>招聘阶段</h3>
      {application.stageOccurrences.length === 0 ? (
        <p className="muted">尚未记录面试阶段。</p>
      ) : (
        <ul>
          {application.stageOccurrences.map((item) => (
            <li key={item.id}>
              {STAGE_LABELS[item.stage]} · {item.occurredOn}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
