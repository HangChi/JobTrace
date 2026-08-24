import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="管理员后台">
      <Link href="/admin">运营概览</Link>
      <Link href="/admin/users">用户管理</Link>
      <Link href="/admin/audit">操作审计</Link>
    </nav>
  );
}
