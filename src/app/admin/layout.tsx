import { requirePageAdmin } from "@/modules/identity-access";
import { AdminNav } from "@/modules/identity-access/ui/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageAdmin();
  return (
    <section className="admin-shell" aria-label="管理员后台">
      <AdminNav />
      <div className="admin-content">{children}</div>
    </section>
  );
}
