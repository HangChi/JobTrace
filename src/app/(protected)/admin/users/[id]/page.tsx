import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import {
  getManagedUserDetail,
  requirePageAdmin,
} from "@/modules/identity-access";
import { AdminUserDetail } from "@/modules/identity-access/ui/admin-user-detail";
import { Problem } from "@/shared/errors/problem";

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    returnTo?: string;
    applicationsPage?: string;
    interviewsPage?: string;
  }>;
}) {
  const actor = await requirePageAdmin();
  const { id } = await params;
  const query = await searchParams;
  let user;
  try {
    user = await getManagedUserDetail(id, {
      applicationsPage: query.applicationsPage,
      interviewsPage: query.interviewsPage,
    });
  } catch (error) {
    if (error instanceof Problem && error.code === "not_found") notFound();
    throw error;
  }
  const requestedReturn = query.returnTo;
  const returnTo = requestedReturn?.startsWith("/admin/users")
    ? requestedReturn
    : "/admin/users";
  return (
    <section className="stack admin-user-detail-page">
      <Link className="admin-back-link" href={returnTo as Route}>
        <span aria-hidden="true">←</span> 返回用户目录
      </Link>
      <AdminUserDetail user={user} actorId={actor.id} returnTo={returnTo} />
    </section>
  );
}
