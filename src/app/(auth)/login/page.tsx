import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, hasAuthConfiguration } from "@/modules/identity-access";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";
import { AuthShell } from "@/modules/identity-access/ui/auth-shell";
import { loginAction } from "../actions";
export default async function Page() {
  const configured = hasAuthConfiguration();
  const a = await getActor();
  if (a) redirect(a.role === "admin" ? "/admin" : "/");
  return (
    <AuthShell
      title="欢迎回来"
      description="登录后，继续跟进你的每一个求职机会。"
      eyebrow="继续你的求职轨迹"
      footer={
        <>
          <span>还没有账号？</span>
          <Link href="/register">免费创建账号</Link>
        </>
      }
    >
      {!configured && (
        <div className="feedback error auth-config-error" role="alert">
          登录功能尚未配置。请在 .env.local 中设置 DATABASE_URL、
          BETTER_AUTH_SECRET 和 BETTER_AUTH_URL，然后重新启动开发服务器。
        </div>
      )}
      {configured && <AuthForm mode="login" action={loginAction} />}
      {configured && (
        <Link className="auth-forgot-link" href="/forgot-password">
          忘记密码？
        </Link>
      )}
    </AuthShell>
  );
}
