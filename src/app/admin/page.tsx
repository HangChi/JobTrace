import Link from "next/link";
import { getAdminSummary } from "@/modules/identity-access";
import { AdminSummary } from "@/modules/identity-access/ui/admin-summary";

export default async function AdminOverviewPage() {
  const summary = await getAdminSummary();
  return (
    <section className="stack page-gap">
      <header>
        <p className="eyebrow">管理员后台</p>
        <h1>运营概览</h1>
        <p className="lead">快速了解账号状态与 JobTrace 的整体使用情况。</p>
      </header>
      <AdminSummary summary={summary} />
      <div className="actions">
        <Link className="button" href="/admin/users">
          进入用户管理
        </Link>
        <Link className="button secondary" href="/admin/audit">
          查看操作审计
        </Link>
      </div>
    </section>
  );
}
