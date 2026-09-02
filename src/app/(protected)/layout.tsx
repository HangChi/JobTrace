import { Suspense } from "react";
import { getActor } from "@/modules/identity-access";
import { AccountMenu } from "@/modules/identity-access/ui/account-menu";

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
