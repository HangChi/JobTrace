import Link from "next/link";
import { AuthForm } from "@/modules/identity-access/ui/auth-form";
import { AuthShell } from "@/modules/identity-access/ui/auth-shell";
import { forgotPasswordAction } from "../actions";
export default function Page() {
  return (
    <AuthShell
      title="找回密码"
      description="输入注册邮箱，我们会向你发送密码重置说明。"
      eyebrow="重新回到你的轨迹"
      footer={<Link href="/login">返回登录</Link>}
    >
      <AuthForm mode="forgot" action={forgotPasswordAction} />
    </AuthShell>
  );
}
