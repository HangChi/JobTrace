import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobTrace 职迹",
  description: "简洁、安全的个人求职投递管理工具",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            JobTrace <span>职迹</span>
          </Link>
          <nav aria-label="主导航">
            <Link href="/">投递记录</Link>
            <Link href="/applications/new">新增投递</Link>
            <Link href="/import">导入数据</Link>
          </nav>
        </header>
        <main className="page-shell">{children}</main>
      </body>
    </html>
  );
}
