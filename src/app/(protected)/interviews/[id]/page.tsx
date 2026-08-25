import { notFound } from "next/navigation";
import { getInterview } from "@/modules/interviews";
import { InterviewEditor } from "@/modules/interviews/ui/interview-editor";
import { requirePageUser } from "@/modules/identity-access";

export const dynamic = "force-dynamic";
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();
  let interview;
  try {
    interview = await getInterview((await params).id);
  } catch {
    return notFound();
  }
  return <InterviewEditor initial={interview} />;
}
