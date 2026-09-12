import { requireUser } from "@/modules/identity-access";
import { PostgresApplicationRepository } from "../infrastructure/postgres-application-repository";

export type ApplicationOption = {
  id: string;
  companyName: string;
  city: string | null;
  positionName: string;
  appliedDate: string;
};

// 面试关联下拉：只取展示所需字段，替代 listApplications({limit:100})
// 的完整 summary 查询（count + 每行 stage lateral join）。
export async function listApplicationOptions(): Promise<ApplicationOption[]> {
  const actor = await requireUser();
  return new PostgresApplicationRepository().listOptions(actor.id);
}

// 个人资料页只需要投递总数，替代跑满 4 个聚合查询的 getAnalyticsSummary。
export async function countApplications(): Promise<number> {
  const actor = await requireUser();
  return new PostgresApplicationRepository().count(actor.id);
}
