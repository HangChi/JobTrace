import type { Metadata } from "next";
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
        <main className="page-shell" id="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
