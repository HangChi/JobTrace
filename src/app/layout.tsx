import type { Metadata } from "next";
import "./styles/profile.css";
import "./globals.css";
import { getActor } from "@/modules/identity-access";
import { AccountMenu } from "@/modules/identity-access/ui/account-menu";
import { ResetPageOnReload } from "@/modules/applications/ui/reset-page-on-reload";

export const metadata: Metadata = {
  title: "JobTrace 职迹",
  description: "简洁、安全的个人求职投递管理工具",
  applicationName: "JobTrace 职迹",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await getActor();
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <ResetPageOnReload />
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <main className="page-shell" id="main-content">
          {actor && <AccountMenu actor={actor} />}
          {children}
        </main>
      </body>
    </html>
  );
}
