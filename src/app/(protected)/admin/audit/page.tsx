import Link from "next/link";
import {
  listAdminAuditEvents,
  requirePageAdmin,
} from "@/modules/identity-access";
import { adminAuditQuerySchema } from "@/modules/identity-access/application/admin-query-schema";
import { AdminAuditFilters } from "@/modules/identity-access/ui/admin-audit-filters";
import { AdminAuditTable } from "@/modules/identity-access/ui/admin-audit-table";

function firstValues(values: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin();
  const query = adminAuditQuerySchema.parse(firstValues(await searchParams));
  const result = await listAdminAuditEvents(query);
  const params = new URLSearchParams();
  if (query.actor) params.set("actor", query.actor);
  if (query.target) params.set("target", query.target);
  if (query.eventType !== "all") params.set("eventType", query.eventType);
  if (query.outcome !== "all") params.set("outcome", query.outcome);
  if (query.occurredFrom) params.set("occurredFrom", query.occurredFrom);
  if (query.occurredTo) params.set("occurredTo", query.occurredTo);
  const href = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `/admin/audit?${next}` as const;
  };
  return (
    <section className="stack page-gap">
      <header>
        <h1>操作审计</h1>
        <p className="lead">查看不可修改的账号访问操作记录。</p>
      </header>
      <AdminAuditFilters query={{ ...query, page: result.page }} />
      <p role="status">共 {result.total} 条匹配记录</p>
      <AdminAuditTable events={result.items} />
      {result.totalPages > 1 ? (
        <nav className="actions" aria-label="审计分页">
          {result.page > 1 ? (
            <Link className="button secondary" href={href(result.page - 1)}>
              上一页
            </Link>
          ) : null}
          <span>
            第 {result.page} / {result.totalPages} 页
          </span>
          {result.page < result.totalPages ? (
            <Link className="button secondary" href={href(result.page + 1)}>
              下一页
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
