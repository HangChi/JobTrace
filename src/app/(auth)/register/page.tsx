import Link from "next/link";
import type { Route } from "next";
import { safeReturnTo } from "@/modules/identity-access";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";
import { AuthShell } from "@/modules/identity-access/ui/auth-shell";
import { registerAction } from "../actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const returnTo = safeReturnTo(first(query.returnTo));
  const loginHref = returnTo
    ? (`/login?returnTo=${encodeURIComponent(returnTo)}` as Route)
    : "/login";
  return (
    <AuthShell
      title="创建你的账号"
      description="从今天开始，把零散的投递整理成看得见的进展。"
      eyebrow="开始记录求职轨迹"
      footer={
        <>
          <span>已经有账号？</span>
          <Link href={loginHref}>返回登录</Link>
        </>
      }
    >
      <AuthForm
        mode="register"
        action={registerAction}
        returnTo={returnTo ?? undefined}
      />
      <p className="auth-terms">创建账号即表示你同意妥善保管自己的登录信息。</p>
    </AuthShell>
  );
}
