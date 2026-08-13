import Link from "next/link";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";
import { AuthShell } from "@/modules/identity-access/ui/auth-shell";
import { registerAction } from "../actions";
export default function Page() {
  return (
    <AuthShell
      title="创建你的账号"
      description="从今天开始，把零散的投递整理成看得见的进展。"
      eyebrow="开始记录求职轨迹"
      footer={
        <>
          <span>已经有账号？</span>
          <Link href="/login">返回登录</Link>
        </>
      }
    >
      <AuthForm mode="register" action={registerAction} />
      <p className="auth-terms">创建账号即表示你同意妥善保管自己的登录信息。</p>
    </AuthShell>
  );
}
