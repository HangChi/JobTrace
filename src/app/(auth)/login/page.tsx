import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import {
  getActor,
  hasAuthConfiguration,
  safeReturnTo,
  usernameSchema,
} from "@/modules/identity-access";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";
import { AuthShell } from "@/modules/identity-access/ui/auth-shell";
import { loginAction } from "../actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const configured = hasAuthConfiguration();
  const a = await getActor();
  if (a && !a.disabled) redirect(a.role === "admin" ? "/admin" : "/");
  const query = await searchParams;
  const returnTo = safeReturnTo(first(query.returnTo));
  const registered = first(query.registered) === "1";
  const parsedUsername = usernameSchema.safeParse(first(query.username));
  const defaultIdentifier =
    registered && parsedUsername.success ? parsedUsername.data : undefined;
  const registerHref = returnTo
    ? (`/register?returnTo=${encodeURIComponent(returnTo)}` as Route)
    : "/register";
  return (
    <AuthShell
      title="欢迎回来"
      description="登录后，继续跟进你的每一个求职机会。"
      eyebrow="继续你的求职轨迹"
      footer={
        <>
          <span>还没有账号？</span>
          <Link href={registerHref}>免费创建账号</Link>
        </>
      }
    >
      {!configured && (
        <div className="feedback error auth-config-error" role="alert">
          登录功能尚未配置。请在 .env.local 中设置 DATABASE_URL、
          BETTER_AUTH_SECRET 和 BETTER_AUTH_URL，然后重新启动开发服务器。
        </div>
      )}
      {configured && registered && (
        <div className="feedback success auth-success" role="status">
          <strong>账号创建成功</strong>
          <span>用户名已为你填好，请输入刚刚设置的密码登录。</span>
        </div>
      )}
      {configured && (
        <AuthForm
          mode="login"
          action={loginAction}
          defaultIdentifier={defaultIdentifier}
          returnTo={returnTo ?? undefined}
        />
      )}
    </AuthShell>
  );
}
