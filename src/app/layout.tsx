import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobTrace 职迹",
  description: "简洁、安全的个人求职投递管理工具",
  applicationName: "JobTrace 职迹",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/" aria-label="JobTrace 职迹首页">
              <Image
                className="brand-mark"
                src="/icon.svg"
                width="40"
                height="40"
                alt=""
              />
              <span className="brand-name">
                JobTrace <small>职迹</small>
              </span>
            </Link>
            <nav aria-label="主导航">
              <Link href="/">投递记录</Link>
              <Link href="/import">导入数据</Link>
              <Link className="nav-primary" href="/applications/new">
                新增投递
              </Link>
            </nav>
          </div>
        </header>
        <main className="page-shell" id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
