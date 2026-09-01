import { requirePageAdmin } from "@/modules/identity-access";
import { listSourceHealth } from "@/modules/job-market/application/source-admin-service";
import { SourceHealthTable } from "@/modules/job-market/ui/admin/source-health-table";
import { SourceForm } from "@/modules/job-market/ui/admin/source-form";
import { DefaultSourceBootstrap } from "@/modules/job-market/ui/admin/default-source-bootstrap";
import { listDefaultSourceCatalog } from "@/modules/job-market/application/source-admin-service";
import { getJobMarketEnv } from "@/shared/config/env";
import { listSourceCandidates } from "@/modules/job-market/application/source-discovery-service";
import { SourceDiscoveryPanel } from "@/modules/job-market/ui/admin/source-discovery-panel";
export const dynamic = "force-dynamic";
export default async function AdminJobMarketPage() {
  await requirePageAdmin();
  const [{ items }, discovery] = await Promise.all([
    listSourceHealth(),
    listSourceCandidates(),
  ]);
  return (
    <section className="stack">
      <header>
        <p className="eyebrow">自动招聘市场</p>
        <h1>来源与同步</h1>
        <p className="lead">管理合规来源、检查新鲜度并重试单个失败来源。</p>
      </header>
      <DefaultSourceBootstrap
        catalog={listDefaultSourceCatalog()}
        scheduledSyncEnabled={getJobMarketEnv().enabled}
      />
      <SourceDiscoveryPanel
        candidates={discovery.items}
        summary={discovery.summary}
      />
      <SourceForm />
      <SourceHealthTable sources={items} />
    </section>
  );
}
