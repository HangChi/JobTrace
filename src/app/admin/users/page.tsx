import Link from "next/link";
import { listUsers } from "@/modules/identity-access";
import { adminUserQuerySchema } from "@/modules/identity-access/application/admin-query-schema";
import { AdminUserFilters } from "@/modules/identity-access/ui/admin-user-filters";
import { UserAdminTable } from "@/modules/identity-access/ui/user-admin-table";

function firstValues(values: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = adminUserQuerySchema.parse(firstValues(await searchParams));
  const result = await listUsers(query);
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.role !== "all") params.set("role", query.role);
  if (query.status !== "all") params.set("status", query.status);
  if (query.registeredFrom) params.set("registeredFrom", query.registeredFrom);
  if (query.registeredTo) params.set("registeredTo", query.registeredTo);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `/admin/users?${next}` as const;
  };
  const returnTo = `/admin/users${params.size || result.page > 1 ? `?${new URLSearchParams({ ...Object.fromEntries(params), page: String(result.page) })}` : ""}`;
  return (
    <section className="stack admin-directory-page">
      <header className="admin-directory-hero">
        <div>
          <p className="eyebrow">ADMIN DIRECTORY</p>
          <h1>账号目录</h1>
          <p>检索账号、核对访问状态，进入档案查看用户的只读求职记录。</p>
        </div>
        <div
          className="admin-directory-total"
          aria-label={`共 ${result.total} 个匹配用户`}
        >
          <strong>{result.total}</strong>
          <span>匹配账号</span>
        </div>
      </header>
      <AdminUserFilters query={{ ...query, page: result.page }} />
      <p className="sr-only" role="status">
        共 {result.total} 个匹配用户
      </p>
      <UserAdminTable users={result.items} returnTo={returnTo} />
      {result.totalPages > 1 ? (
        <nav className="admin-directory-pagination" aria-label="用户分页">
          {result.page > 1 ? (
            <Link className="button secondary" href={pageHref(result.page - 1)}>
              上一页
            </Link>
          ) : null}
          <span>
            第 {result.page} / {result.totalPages} 页
          </span>
          {result.page < result.totalPages ? (
            <Link className="button secondary" href={pageHref(result.page + 1)}>
              下一页
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
