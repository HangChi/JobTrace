"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

export function ResetPageOnReload() {
  const router = useRouter();

  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload") return;

    const firstPage = new URL(window.location.href);
    const page = Number(firstPage.searchParams.get("page") ?? "1");
    if (!Number.isFinite(page) || page <= 1) return;

    firstPage.searchParams.delete("page");
    firstPage.searchParams.delete("cursor");
    firstPage.searchParams.delete("history");
    router.replace(`${firstPage.pathname}${firstPage.search}` as Route, {
      scroll: false,
    });
  }, [router]);

  return null;
}
