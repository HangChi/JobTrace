import Link from "next/link";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";
import { AuthShell } from "@/modules/identity-access/ui/auth-shell";
import { resetPasswordAction } from "../actions";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawToken = (await searchParams).token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  return (
    <AuthShell
      title="设置新密码"
      description="使用一个安全且容易记住的新密码。"
      footer={<Link href="/login">返回登录</Link>}
    >
      <AuthForm mode="reset" action={resetPasswordAction} token={token} />
    </AuthShell>
  );
}
