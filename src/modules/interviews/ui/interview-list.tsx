import Link from "next/link";
import type { Route } from "next";
import type { InterviewPage } from "../application/contracts";
import { REVIEW_STATUS_LABELS, ROUND_RESULT_LABELS } from "../domain/catalog";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import { DeleteInterviewDialog } from "./delete-interview-dialog";

export function InterviewList({
  page,
  nextHref,
}: {
  page: InterviewPage;
  nextHref: string | null;
}) {
  if (!page.items.length)
    return (
      <section className="panel interview-empty-state">
        <p className="section-kicker">INTERVIEW NOTES</p>
        <h2>还没有面经</h2>
        <p>从已有投递选择一次面试，记录问题和复盘。</p>
        <Link className="button" href={"/interviews/new" as Route}>
          记录面经
        </Link>
      </section>
    );
  return (
    <section className="panel interview-list-panel">
      <div className="section-heading">
        <div>
          <p className="section-kicker">INTERVIEW ARCHIVE</p>
          <h2>面经记录</h2>
        </div>
        <span className="muted">共 {page.total} 篇</span>
      </div>
      <ol className="interview-list">
        {page.items.map((item) => (
          <li key={item.id}>
            <time dateTime={item.interviewedOn}>{item.interviewedOn}</time>
            <div className="interview-list-main">
              <Link href={`/interviews/${item.id}` as Route}>
                <strong>
                  {item.companyName} · {item.positionName}
                </strong>
              </Link>
              <p>
                {STAGE_LABELS[item.stage]} · {item.questionCount} 个问题 ·{" "}
                {item.actionCount} 个行动
              </p>
            </div>
            <span className={`review-status status-${item.status}`}>
              {REVIEW_STATUS_LABELS[item.status]}
            </span>
            <span className={`round-result result-${item.roundResult}`}>
              {ROUND_RESULT_LABELS[item.roundResult]}
            </span>
            <DeleteInterviewDialog
              id={item.id}
              name={`${item.companyName} · ${STAGE_LABELS[item.stage]}`}
            />
          </li>
        ))}
      </ol>
      {nextHref && (
        <div className="pagination">
          <Link className="button secondary" href={nextHref as Route}>
            下一页
          </Link>
        </div>
      )}
    </section>
  );
}
