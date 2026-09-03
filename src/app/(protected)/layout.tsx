import { Suspense } from "react";
import { getActor } from "@/modules/identity-access";
import { AccountMenu } from "@/modules/identity-access/ui/account-menu";
import "../styles/system.css";
import "../styles/workspace.css";
import "../styles/classic-theme.css";
import "../styles/job-market.css";

async function AuthenticatedAccountMenu() {
  const actor = await getActor();
  return actor ? <AccountMenu actor={actor} /> : null;
}

export default function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Suspense fallback={null}>
        <AuthenticatedAccountMenu />
      </Suspense>
      {children}
    </>
  );
}
