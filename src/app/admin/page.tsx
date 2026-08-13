import { listUsers, requirePageAdmin } from "@/modules/identity-access";
import { UserAdminTable } from "@/modules/identity-access/ui/user-admin-table";
export default async function Page() {
  await requirePageAdmin();
  const users = await listUsers();
  return (
    <section className="stack page-gap">
      <div>
        <p className="eyebrow">管理员后台</p>
        <h1>用户管理</h1>
        <p className="lead">
          管理账号角色和访问状态。最后一个有效管理员受到保护。
        </p>
      </div>
      <UserAdminTable users={users} />
    </section>
  );
}
