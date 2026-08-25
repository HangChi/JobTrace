import { Suspense } from "react";
import { getActor } from "@/modules/identity-access";
import { AccountMenu } from "@/modules/identity-access/ui/account-menu";
import { ResetPageOnReload } from "@/modules/applications/ui/reset-page-on-reload";

async function AuthenticatedAccountMenu() {
  const actor = await getActor();
  return actor ? <AccountMenu actor={actor} /> : null;
}

export default function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ResetPageOnReload />
      <Suspense fallback={null}>
        <AuthenticatedAccountMenu />
      </Suspense>
      {children}
    </>
  );
}
