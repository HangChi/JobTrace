"use server";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { asProblem } from "@/shared/errors/problem";
import {
  login,
  logout,
  register,
  registerFormSchema,
  requestPasswordReset,
  safeReturnTo,
  updatePassword,
} from "@/modules/identity-access";
export type AuthActionState = {
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};
const values = (d: FormData) => Object.fromEntries(d.entries());
const isRedirect = (error: unknown) =>
  (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT");

function actionError(error: unknown): AuthActionState {
  const problem = asProblem(error);
  return {
    error: problem.message,
    fieldErrors: Object.fromEntries(
      (problem.fieldErrors ?? []).map((item) => [item.field, item.message]),
    ),
  };
}

export async function loginAction(
  _: AuthActionState,
  d: FormData,
): Promise<AuthActionState> {
  try {
    const r = await login(values(d));
    redirect(r.redirectTarget as Route);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return actionError(e);
  }
}
export async function registerAction(
  _: AuthActionState,
  d: FormData,
): Promise<AuthActionState> {
  try {
    const value = registerFormSchema.parse(values(d));
    await register(value);
    const query = new URLSearchParams({
      registered: "1",
      username: value.username,
    });
    const returnTo = safeReturnTo(value.returnTo);
    if (returnTo) query.set("returnTo", returnTo);
    redirect(`/login?${query.toString()}` as Route);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return actionError(e);
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
    return actionError(e);
  }
}
export async function logoutAction() {
  await logout();
  redirect("/login");
}
