import { notFound } from "next/navigation";
import { getPublicInterview } from "@/modules/interviews";
import { PublicInterviewDetail } from "@/modules/interviews/ui/public-interview-detail";
import { requirePageUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";

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
  } catch (error) {
    if (error instanceof Problem && error.code === "not_found") notFound();
    throw error;
  }
  return <PublicInterviewDetail interview={interview} />;
}
