"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const items: Array<{ href: Route; label: string; exact?: boolean }> = [
    { href: "/admin", label: "运营概览", exact: true },
    { href: "/admin/users", label: "用户管理" },
    { href: "/admin/audit", label: "操作审计" },
    { href: "/admin/job-market" as Route, label: "招聘同步" },
  ];

  return (
    <nav className="admin-nav" aria-label="管理员后台">
      {items.map((item) => {
        const current = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            href={item.href}
            key={item.href}
            aria-current={current ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
