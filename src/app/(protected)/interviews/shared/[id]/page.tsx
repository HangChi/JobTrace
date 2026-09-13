import { notFound } from "next/navigation";
import { getPublicInterview } from "@/modules/interviews";
import { PublicInterviewDetail } from "@/modules/interviews/ui/public-interview-detail";
import { requirePageUser } from "@/modules/identity-access";

export const dynamic = "force-dynamic";

export default async function SharedInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser();
  let interview;
  try {
    interview = await getPublicInterview((await params).id);
  } catch {
    return notFound();
  }
  return <PublicInterviewDetail interview={interview} />;
}
