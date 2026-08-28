import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  formatCompanyWithCity,
  getApplication,
  listApplications,
} from "@/modules/applications";
import { listApplicationInterviews } from "@/modules/interviews";
import { InterviewCreateForm } from "@/modules/interviews/ui/interview-create-form";
import { requirePageUser } from "@/modules/identity-access";

export const dynamic = "force-dynamic";

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageUser();
  const query = await searchParams;
  let selected;
  if (query.applicationId) {
    selected = await getApplication(query.applicationId);
    if (query.stageOccurrenceId) {
      const existing = (
        await listApplicationInterviews(query.applicationId)
      ).find((item) => item.stageOccurrenceId === query.stageOccurrenceId);
      if (existing) redirect(`/interviews/${existing.id}` as Route);
    }
  }
  const page = await listApplications(new URLSearchParams({ limit: "100" }));
  const occurrence = selected?.stageOccurrences.find(
    (item) => item.id === query.stageOccurrenceId,
  );
  return (
    <section className="stack page-gap">
      <div className="hero-row">
        <div>
          <h1>新增面试复盘</h1>
          <p className="lead">选择关联投递，填写面试日期和复盘内容。</p>
        </div>
      </div>
      <InterviewCreateForm
        applications={page.items.map((item) => ({
          id: item.id,
          label: `${formatCompanyWithCity(item.companyName, item.city)} · ${item.positionName}`,
          appliedDate: item.appliedDate,
        }))}
        applicationId={selected?.id}
        stageOccurrenceId={occurrence?.id}
        stage={occurrence?.stage ?? query.stage}
        stageOccurredOn={occurrence?.occurredOn}
        interviewedOn={query.interviewedOn ?? occurrence?.occurredOn}
      />
    </section>
  );
}
