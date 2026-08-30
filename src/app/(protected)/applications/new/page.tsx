import { ApplicationForm } from "@/modules/applications/ui/application-form";
import { requirePageUser } from "@/modules/identity-access";
import { getPublicJobForTracking } from "@/modules/job-market/application/tracking-service";
import { redirect } from "next/navigation";
export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ jobMarketPostId?: string }>;
}) {
  await requirePageUser();
  const { jobMarketPostId } = await searchParams;
  const job = jobMarketPostId
    ? await getPublicJobForTracking(jobMarketPostId)
    : null;
  if (job?.existingApplicationId)
    redirect(`/applications/${job.existingApplicationId}`);
  return (
    <section className="stack">
      <div>
        <h1>新增投递</h1>
        <p className="lead">
          先填写公司、岗位和投递日期，其他信息可以稍后补充。
        </p>
      </div>
      <ApplicationForm
        defaults={
          job
            ? {
                jobMarketPostId: job.id,
                companyName: job.companyName,
                positionName: job.positionName,
                city: job.city,
                jobUrl: job.jobUrl,
              }
            : undefined
        }
      />
    </section>
  );
}
