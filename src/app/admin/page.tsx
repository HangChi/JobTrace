import {
  getAdminSummary,
  listUsers,
  requirePageAdmin,
} from "@/modules/identity-access";
import { UserAdminTable } from "@/modules/identity-access/ui/user-admin-table";
import { AdminSummary } from "@/modules/identity-access/ui/admin-summary";
import Link from "next/link";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePageAdmin();
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const [users, summary] = await Promise.all([
    listUsers(page, 50),
    getAdminSummary(),
  ]);
  return (
    <section className="stack page-gap">
      <div>
        <p className="eyebrow">管理员后台</p>
        <h1>用户管理</h1>
        <p className="lead">
          管理账号角色和访问状态。最后一个有效管理员受到保护。
        </p>
      </div>
      <AdminSummary summary={summary} />
      <UserAdminTable users={users} />
      <nav className="actions" aria-label="用户分页">
        {page > 1 ? (
          <Link className="button secondary" href={`/admin?page=${page - 1}`}>
            上一页
          </Link>
        ) : null}
        {users.length === 50 ? (
          <Link className="button secondary" href={`/admin?page=${page + 1}`}>
            下一页
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
