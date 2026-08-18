import { notFound } from "next/navigation";
import { getApplication, STATUS_LABELS } from "@/modules/applications";
import { ApplicationEditor } from "@/modules/applications/ui/application-editor";
import { ApplicationHistory } from "@/modules/applications/ui/application-history";
import { DeleteApplicationDialog } from "@/modules/applications/ui/delete-application-dialog";
import { requirePageUser } from "@/modules/identity-access";
import Link from "next/link";
import type { Route } from "next";
import { listApplicationInterviews, REVIEW_STATUS_LABELS } from "@/modules/interviews";
import { STAGE_LABELS } from "@/modules/applications";

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
  return (
    <section className="stack">
      <div>
        <span className="badge">{STATUS_LABELS[application.status]}</span>
        <h1>{application.companyName}</h1>
        <p className="lead">
          {application.positionName} · {application.city ?? "城市未填写"} ·
          投递于 {application.appliedDate}
        </p>
        <div className="actions">
          <DeleteApplicationDialog
            id={application.id}
            name={`${application.companyName} ${application.positionName}`}
          />
        </div>
      </div>
      {application.notes && (
        <section className="panel">
          <h2>备注</h2>
          <p>{application.notes}</p>
        </section>
      )}
      <ApplicationEditor application={application} />
      <section className="panel stack">
        <div className="section-heading"><div><p className="section-kicker">INTERVIEW REVIEWS</p><h2>面经复盘</h2></div><Link className="button secondary" href={`/interviews/new?applicationId=${application.id}` as Route}>记录面经</Link></div>
        {interviews.length ? <ul className="application-interview-list">{interviews.map((item) => <li key={item.id}><span>{STAGE_LABELS[item.stage]} · {item.interviewedOn}</span><span className={`review-status status-${item.status}`}>{REVIEW_STATUS_LABELS[item.status]}</span><Link href={`/interviews/${item.id}` as Route}>打开复盘</Link></li>)}</ul> : <p className="muted">阶段时间线中的一面、二面等面试阶段可以直接记录面经。</p>}
      </section>
      <ApplicationHistory application={application} />
    </section>
  );
}
