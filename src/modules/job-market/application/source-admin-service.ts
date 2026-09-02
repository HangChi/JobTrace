import { requireAdmin } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import {
  sourceIdSchema,
  sourceInputSchema,
  sourceUpdateSchema,
} from "./contracts";
import { PostgresSyncRepository } from "../infrastructure/postgres-sync-repository";
import { synchronizeOneSource } from "./synchronize-due-sources";
import { validateHttpsUrl } from "../infrastructure/secure-source-client.server";
import {
  DEFAULT_SOURCE_CATALOG,
  publicDefaultSourceCatalog,
} from "./default-source-catalog";
import { PostgresSourceCatalogRepository } from "../infrastructure/postgres-source-catalog-repository";
import {
  DEFAULT_COMPANY_DIRECTORY,
  publicDefaultCompanyDirectory,
} from "./default-company-directory";

const repository = () => new PostgresSyncRepository();
export async function listSourceHealth() {
  await requireAdmin();
  return { items: await repository().listSources() };
}
export async function registerSource(value: unknown) {
  await requireAdmin();
  const input = sourceInputSchema.parse(value);
  validateHttpsUrl(input.baseUrl, input.allowedHosts);
  try {
    const id = await repository().createSource(input);
    return (await repository().listSources()).find((item) => item.id === id);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new Problem("conflict", "该招聘来源已经登记。", 409);
    throw error;
  }
}
export async function updateSource(id: string, value: unknown) {
  await requireAdmin();
  const sourceId = sourceIdSchema.parse(id);
  const input = sourceUpdateSchema.parse(value);
  if (!(await repository().updateSource(sourceId, input)))
    throw new Problem("not_found", "没有找到该招聘来源。", 404);
  return (await repository().listSources()).find((item) => item.id === id);
}
export async function retrySource(id: string, requestId: string) {
  await requireAdmin();
  const result = await synchronizeOneSource(
    sourceIdSchema.parse(id),
    requestId,
  );
  if (!result.accepted)
    throw new Problem(
      "source_unavailable_or_leased",
      "该来源已暂停、撤销或正在同步。",
      409,
    );
  return result;
}
export async function listSyncRuns(params: URLSearchParams) {
  await requireAdmin();
  const sourceId = params.get("sourceId") || undefined;
  if (sourceId) sourceIdSchema.parse(sourceId);
  const page = Math.max(1, Number(params.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 20)));
  return repository().listRuns(sourceId, page, limit);
}

export function listDefaultSourceCatalog() {
  return [
    ...publicDefaultSourceCatalog().map((entry) => ({
      ...entry,
      channel: "automatic" as const,
      channelLabel: `自动同步：${entry.adapter}`,
    })),
    ...publicDefaultCompanyDirectory(),
  ];
}

export async function initializeDefaultSources(requestId: string) {
  await requireAdmin();
  for (const entry of DEFAULT_SOURCE_CATALOG)
    validateHttpsUrl(entry.baseUrl, entry.allowedHosts);

  const initialized = await new PostgresSourceCatalogRepository().initialize(
    DEFAULT_SOURCE_CATALOG,
    DEFAULT_COMPANY_DIRECTORY,
  );
  const syncResults: Awaited<ReturnType<typeof synchronizeOneSource>>[] = [];
  const sourceIds = [...initialized.activeSourceIds];
  while (sourceIds.length) {
    const batch = sourceIds.splice(0, 3);
    syncResults.push(
      ...(await Promise.all(
        batch.map((sourceId) => synchronizeOneSource(sourceId, requestId)),
      )),
    );
  }

  return {
    ...initialized,
    sync: {
      requested: initialized.activeSourceIds.length,
      accepted: syncResults.filter((result) => result.accepted).length,
      succeeded: syncResults.filter((result) => result.status === "succeeded")
        .length,
      partial: syncResults.filter((result) => result.status === "partial")
        .length,
      failed: syncResults.filter((result) => result.status === "failed").length,
      skipped: syncResults.filter((result) => !result.accepted).length,
    },
  };
}
