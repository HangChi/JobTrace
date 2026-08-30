"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "招聘广场",
    matches: (path: string) => path === "/",
  },
  {
    href: "/applications",
    label: "我的投递",
    matches: (path: string) => path.startsWith("/applications"),
  },
  {
    href: "/interviews",
    label: "面经",
    matches: (path: string) => path.startsWith("/interviews"),
  },
  {
    href: "/analytics",
    label: "求职分析",
    matches: (path: string) => path.startsWith("/analytics"),
  },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();
  return (
    <div className="app-primary-nav" aria-label="主要功能">
      {ITEMS.map((item) => {
        const current = item.matches(pathname);
        return (
          <Link
            href={item.href as Route}
            key={item.href}
            aria-current={current ? "page" : undefined}
            className={current ? "is-current" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
