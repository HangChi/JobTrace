"use server";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { asProblem } from "@/shared/errors/problem";
import {
  login,
  logout,
  register,
  requestPasswordReset,
  updatePassword,
} from "@/modules/identity-access";
export type AuthActionState = { message?: string; error?: string };
const values = (d: FormData) => Object.fromEntries(d.entries());
export async function loginAction(
  _: AuthActionState,
  d: FormData,
): Promise<AuthActionState> {
  try {
    const r = await login(values(d));
    redirect(r.redirectTarget as Route);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { error: asProblem(e).message };
  }
}
export async function registerAction(
  _: AuthActionState,
  d: FormData,
): Promise<AuthActionState> {
  try {
    return await register(values(d));
  } catch (e) {
    return { error: asProblem(e).message };
  }
}
export async function forgotPasswordAction(
  _: AuthActionState,
  d: FormData,
): Promise<AuthActionState> {
  try {
    return await requestPasswordReset(d.get("email"));
  } catch {
    return { message: "如果该邮箱存在，我们已发送密码重置说明。" };
  }
}
export async function resetPasswordAction(
  _: AuthActionState,
  d: FormData,
): Promise<AuthActionState> {
  try {
    await updatePassword(d.get("password"));
    return { message: "密码已更新，请重新登录。" };
  } catch (e) {
    return { error: asProblem(e).message };
  }
}
export async function logoutAction() {
  await logout();
  redirect("/login");
}
