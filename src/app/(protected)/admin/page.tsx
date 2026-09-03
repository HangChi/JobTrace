import { getAdminSummary, requirePageAdmin } from "@/modules/identity-access";
import { AdminSummary } from "@/modules/identity-access/ui/admin-summary";

export default async function AdminOverviewPage() {
  await requirePageAdmin();
  const summary = await getAdminSummary();
  return (
    <section className="stack page-gap admin-overview-page">
      <header className="admin-page-header">
        <h1>运营概览</h1>
        <p className="lead">查看账号状态和系统使用情况。</p>
      </header>
      <AdminSummary summary={summary} />
    </section>
  );
}
