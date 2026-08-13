import { notFound } from "next/navigation";
import { getApplication, STATUS_LABELS } from "@/modules/applications";
import { ApplicationEditor } from "@/modules/applications/ui/application-editor";
import { ApplicationHistory } from "@/modules/applications/ui/application-history";
import { DeleteApplicationDialog } from "@/modules/applications/ui/delete-application-dialog";
import { requirePageUser } from "@/modules/identity-access";

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
      <ApplicationHistory application={application} />
    </section>
  );
}
