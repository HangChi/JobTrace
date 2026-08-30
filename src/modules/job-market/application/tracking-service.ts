import { requireUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import { createServerDatabase } from "@/shared/database";
import { campaignIdSchema } from "./contracts";

export async function getPublicJobForTracking(id: string) {
  const actor = await requireUser();
  const jobId = campaignIdSchema.parse(id);
  const sql = createServerDatabase();
  const [row] = await sql<
    Array<{
      id: string;
      companyName: string;
      positionName: string;
      city: string | null;
      jobUrl: string | null;
      status: string;
      existingApplicationId: string | null;
    }>
  >`
    select post.id,company.canonical_name as "companyName",post.title as "positionName",post.primary_apply_url as "jobUrl",post.status::text,
      (select string_agg(location.display_name,'、' order by location.display_name) from job_market_post_locations pl join job_market_locations location on location.id=pl.location_id where pl.post_id=post.id) as city,
      link.application_id as "existingApplicationId"
    from job_market_posts post join job_market_companies company on company.id=post.company_id
    left join application_job_market_links link on link.post_id=post.id and link.owner_id=${actor.id}
    where post.id=${jobId}`;
  if (!row) throw new Problem("not_found", "没有找到这个公共岗位。", 404);
  return row;
}
