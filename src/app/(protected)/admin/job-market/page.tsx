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
  const activeSourceCount = items.filter(
    (source) => source.status === "active",
  ).length;
  const attentionSourceCount = items.filter(
    (source) =>
      source.status !== "active" || source.latestRun?.status === "failed",
  ).length;
  return (
    <section className="stack admin-sync-page">
      <header className="admin-sync-hero">
        <div>
          <p className="eyebrow">招聘市场 · 数据运营</p>
          <h1>来源与同步</h1>
          <p className="lead">管理合规来源、检查同步健康度并处理待审核入口。</p>
        </div>
        <dl className="admin-sync-hero-stats" aria-label="招聘同步概况">
          <div>
            <dt>自动来源</dt>
            <dd>{items.length}</dd>
          </div>
          <div>
            <dt>运行中</dt>
            <dd>{activeSourceCount}</dd>
          </div>
          <div className={attentionSourceCount ? "is-attention" : undefined}>
            <dt>需关注</dt>
            <dd>{attentionSourceCount}</dd>
          </div>
          <div
            className={
              discovery.summary.pendingCandidates ? "is-pending" : undefined
            }
          >
            <dt>待审核</dt>
            <dd>{discovery.summary.pendingCandidates}</dd>
          </div>
        </dl>
      </header>
      <SourceDiscoveryPanel
        candidates={discovery.items}
        summary={discovery.summary}
      />
      <SourceHealthTable sources={items} />
      <div className="admin-sync-setup-grid">
        <DefaultSourceBootstrap
          catalog={listDefaultSourceCatalog()}
          scheduledSyncEnabled={getJobMarketEnv().enabled}
        />
        <SourceForm />
      </div>
    </section>
  );
}
