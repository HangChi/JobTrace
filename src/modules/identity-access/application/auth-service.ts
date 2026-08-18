import "server-only";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { hasAuthConfiguration } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
import {
  emailSchema,
  loginSchema,
  registerSchema,
  safeReturnTo,
} from "./auth-schema";
import { auth } from "../infrastructure/better-auth.server";
import { requireUser } from "./authorization";

const credentialError = () =>
  new Problem("invalid_credentials", "用户名或密码不正确。", 401);

function requireAuthConfiguration() {
  if (!hasAuthConfiguration())
    throw new Problem(
      "auth_not_configured",
      "登录功能尚未配置，请设置数据库连接和认证密钥。",
      503,
    );
}

export async function register(input: unknown) {
  requireAuthConfiguration();
  const value = registerSchema.parse(input);
  try {
    await auth.api.signUpEmail({
      body: {
        email: `${value.username}@users.jobtrace.local`,
        password: value.password,
        name: value.displayName ?? value.username,
        username: value.username,
        displayUsername: value.username,
      },
    });
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 422)
      throw new Problem("registration_conflict", "该用户名已注册。", 409);
    throw new Problem(
      "registration_failed",
      "暂时无法完成注册，请稍后重试。",
      400,
    );
  }
  return { message: "账号已创建，请登录。" };
}

export async function login(input: unknown) {
  requireAuthConfiguration();
  const value = loginSchema.parse(input);
  try {
    const result = await auth.api.signInUsername({
      body: { username: value.username, password: value.password },
      headers: await headers(),
    });
    const user = result.user as typeof result.user & {
      role?: string;
      banned?: boolean | null;
    };
    if (user.banned) {
      await auth.api.signOut({ headers: await headers() });
      throw credentialError();
    }
    return {
      redirectTarget:
        safeReturnTo(value.returnTo) ??
        (user.role === "admin" ? "/admin" : "/"),
    };
  } catch {
    throw credentialError();
  }
}

export async function logout() {
  requireAuthConfiguration();
  await auth.api.signOut({ headers: await headers() });
}

export async function requestPasswordReset(email: unknown) {
  requireAuthConfiguration();
  emailSchema.parse(email);
  return { message: "密码恢复邮件尚未配置，请联系管理员重置密码。" };
}

export async function updatePassword(password: unknown) {
  registerSchema.shape.password.parse(password);
  throw new Problem(
    "password_reset_not_configured",
    "密码恢复邮件尚未配置，请联系管理员。",
    503,
  );
}

export async function updateProfile(input: unknown) {
  const actor = await requireUser();
  const value = z
    .object({
      displayName: z.string().trim().min(1, "请输入昵称").max(100),
      image: z.union([z.url(), z.literal(""), z.null()]).optional(),
    })
    .parse(input);
  await auth.api.updateUser({
    body: { name: value.displayName, image: value.image || null },
    headers: await headers(),
  });
  return {
    id: actor.id,
    displayName: value.displayName,
    image: value.image || null,
  };
}
