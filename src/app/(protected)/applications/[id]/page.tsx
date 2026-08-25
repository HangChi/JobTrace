import { notFound } from "next/navigation";
import { getApplication, STATUS_LABELS } from "@/modules/applications";
import { ApplicationEditor } from "@/modules/applications/ui/application-editor";
import { DeleteApplicationDialog } from "@/modules/applications/ui/delete-application-dialog";
import { requirePageUser } from "@/modules/identity-access";
import Link from "next/link";
import type { Route } from "next";
import {
  listApplicationInterviews,
  REVIEW_STATUS_LABELS,
} from "@/modules/interviews";
import { STAGE_LABELS, formatCompanyWithCity } from "@/modules/applications";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();
  let application;
  try {
    application = await getApplication((await params).id);
  } catch {
    return notFound();
  }
  const interviews = await listApplicationInterviews(application.id);
  const companyDisplayName = formatCompanyWithCity(
    application.companyName,
    application.city,
  );
  return (
    <section className="stack application-detail-page">
      <header className="application-detail-header">
        <Link className="application-detail-back" href="/">
          <span aria-hidden="true">←</span> 返回投递记录
        </Link>
        <div>
          <span className="badge">{STATUS_LABELS[application.status]}</span>
          <h1>{companyDisplayName}</h1>
          <p className="lead">
            {application.positionName} · {application.city ?? "城市未填写"} ·
            投递于 {application.appliedDate}
          </p>
        </div>
      </header>
      {application.notes && (
        <section className="panel">
          <h2>备注</h2>
          <p>{application.notes}</p>
        </section>
      )}
      <ApplicationEditor application={application} interviews={interviews} />
      <section className="panel stack">
        <div className="section-heading">
          <div>
            <p className="section-kicker">INTERVIEW REVIEWS</p>
            <h2>面经复盘</h2>
          </div>
          <Link
            className="button secondary"
            href={`/interviews/new?applicationId=${application.id}` as Route}
          >
            记录面经
          </Link>
        </div>
        {interviews.length ? (
          <ul className="application-interview-list">
            {interviews.map((item) => (
              <li key={item.id}>
                <span>
                  {STAGE_LABELS[item.stage]} · {item.interviewedOn}
                </span>
                <span className={`review-status status-${item.status}`}>
                  {REVIEW_STATUS_LABELS[item.status]}
                </span>
                <Link href={`/interviews/${item.id}` as Route}>打开复盘</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            阶段时间线中的一面、二面等面试阶段可以直接记录面经。
          </p>
        )}
      </section>
      <section
        className="application-danger-zone"
        aria-labelledby="delete-application-title"
      >
        <div>
          <p className="section-kicker">DANGER ZONE</p>
          <h2 id="delete-application-title">删除这条投递</h2>
          <p>删除后，招聘阶段、更新历史和面经复盘也会一起移除。</p>
        </div>
        <DeleteApplicationDialog
          id={application.id}
          name={`${companyDisplayName} ${application.positionName}`}
        />
      </section>
    </section>
  );
}
