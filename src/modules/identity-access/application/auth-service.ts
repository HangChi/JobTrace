import "server-only";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import { createServerDatabase } from "@/shared/database";
import { hasAuthConfiguration } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
import {
  emailSchema,
  loginSchema,
  registerSchema,
  safeReturnTo,
} from "./auth-schema";
import { auth } from "../infrastructure/better-auth.server";
import { checkAuthRateLimit } from "../infrastructure/auth-rate-limit";
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
    const result = await auth.api.signUpEmail({
      body: {
        email: `${value.username}@users.jobtrace.local`,
        password: value.password,
        name: value.displayName ?? value.username,
        username: value.username,
        displayUsername: value.username,
      },
    });
    if (value.recoveryEmail) {
      const sql = createServerDatabase();
      try {
        await sql`update public.users set recovery_email=${value.recoveryEmail}
          where id=${result.user.id}`;
      } catch (error) {
        await sql`delete from public.users where id=${result.user.id}`;
        if ((error as { code?: string }).code === "23505") {
          throw new Problem(
            "registration_conflict",
            "该恢复邮箱已被使用。",
            409,
            [
              {
                field: "recoveryEmail",
                code: "registration_conflict",
                message: "该恢复邮箱已关联其他账号。",
              },
            ],
          );
        }
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Problem) throw error;
    const code = error instanceof APIError ? error.body?.code : undefined;
    if (
      code === "USERNAME_IS_ALREADY_TAKEN" ||
      code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
    )
      throw new Problem("registration_conflict", "该用户名已注册。", 409, [
        {
          field: "username",
          code: "registration_conflict",
          message: "该用户名已注册，请更换一个。",
        },
      ]);
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
  const recoveryEmail = emailSchema.parse(email);
  const requestHeaders = await headers();
  const rateKey =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "local-password-reset";
  await checkAuthRateLimit(rateKey, "password-reset", 5, 15 * 60_000);
  const sql = createServerDatabase();
  const [user] = await sql<{ email: string }[]>`
    select email from public.users
    where lower(recovery_email)=lower(${recoveryEmail}) and disabled=false
  `;
  await auth.api.requestPasswordReset({
    body: {
      email: user?.email ?? "missing-account@users.jobtrace.local",
      redirectTo: "/reset-password",
    },
  });
  return { message: "如果该邮箱存在，我们已发送密码重置说明。" };
}

export async function updatePassword(password: unknown, token: unknown) {
  const newPassword = registerSchema.shape.password.parse(password);
  const resetToken = z.string().min(1).max(200).parse(token);
  try {
    await auth.api.resetPassword({
      body: { newPassword, token: resetToken },
    });
  } catch {
    throw new Problem(
      "invalid_reset_token",
      "重置链接无效或已过期，请重新申请。",
      400,
    );
  }
}

export async function updateProfile(input: unknown) {
  const actor = await requireUser();
  const value = z
    .object({
      displayName: z.string().trim().min(1, "请输入昵称").max(100),
      recoveryEmail: z.union([emailSchema, z.literal("")]).optional(),
      image: z.union([z.url(), z.literal(""), z.null()]).optional(),
    })
    .parse(input);
  const sql = createServerDatabase();
  if (value.recoveryEmail) {
    const [conflictingUser] = await sql<{ id: string }[]>`
      select id from public.users
      where lower(recovery_email)=lower(${value.recoveryEmail})
        and id<>${actor.id}
      limit 1
    `;
    if (conflictingUser) {
      throw new Problem("profile_conflict", "该恢复邮箱已关联其他账号。", 409, [
        {
          field: "recoveryEmail",
          code: "profile_conflict",
          message: "请使用其他恢复邮箱。",
        },
      ]);
    }
  }
  await auth.api.updateUser({
    body: { name: value.displayName, image: value.image || null },
    headers: await headers(),
  });
  let recoveryEmail: string | null;
  try {
    if (value.recoveryEmail === undefined) {
      const [current] = await sql<{ recoveryEmail: string | null }[]>`
        select recovery_email from public.users where id=${actor.id}
      `;
      recoveryEmail = current?.recoveryEmail ?? null;
    } else {
      const [updated] = await sql<{ recoveryEmail: string | null }[]>`
        update public.users
        set recovery_email=${value.recoveryEmail || null},updated_at=now()
        where id=${actor.id}
        returning recovery_email
      `;
      recoveryEmail = updated?.recoveryEmail ?? null;
    }
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Problem("profile_conflict", "该恢复邮箱已关联其他账号。", 409, [
        {
          field: "recoveryEmail",
          code: "profile_conflict",
          message: "请使用其他恢复邮箱。",
        },
      ]);
    }
    throw error;
  }
  return {
    id: actor.id,
    displayName: value.displayName,
    image: value.image || null,
    recoveryEmail,
  };
}

export async function getProfile() {
  const actor = await requireUser();
  const sql = createServerDatabase();
  const [profile] = await sql<
    Array<{
      username: string | null;
      displayUsername: string | null;
      createdAt: Date;
      updatedAt: Date;
      recoveryEmail: string | null;
    }>
  >`select username,display_username,recovery_email,created_at,updated_at
    from public.users where id=${actor.id}`;
  if (!profile) throw new Problem("not_found", "没有找到账号资料。", 404);
  return {
    ...actor,
    username:
      profile.displayUsername ??
      profile.username ??
      actor.email.split("@")[0] ??
      "user",
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    recoveryEmail: profile.recoveryEmail,
  };
}

export async function listAccountSessions() {
  const actor = await requireUser();
  const current = await auth.api.getSession({ headers: await headers() });
  const sql = createServerDatabase();
  const rows = await sql<
    Array<{
      id: string;
      createdAt: Date;
      expiresAt: Date;
      userAgent: string | null;
    }>
  >`
    select id,created_at,expires_at,user_agent
    from public.sessions
    where user_id=${actor.id} and expires_at > now()
    order by created_at desc
  `;
  return rows.map((session) => ({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    userAgent: session.userAgent,
    current: session.id === current?.session.id,
  }));
}

export async function revokeAccountSession(id: unknown) {
  const actor = await requireUser();
  const sessionId = z.string().min(1).max(255).parse(id);
  const sql = createServerDatabase();
  const rows = await sql`
    delete from public.sessions
    where id=${sessionId} and user_id=${actor.id}
    returning id
  `;
  if (!rows.length) throw new Problem("not_found", "登录会话已不存在。", 404);
  return { revoked: true };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z
    .string()
    .min(8, "新密码至少需要 8 位")
    .max(16, "新密码不能超过 16 位"),
});

export async function changePassword(input: unknown) {
  await requireUser();
  const value = changePasswordSchema.parse(input);
  try {
    await auth.api.changePassword({
      body: {
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === "INVALID_PASSWORD") {
        throw new Problem(
          "invalid_password",
          "当前密码不正确，请重新输入。",
          400,
          [
            {
              field: "currentPassword",
              code: "invalid_password",
              message: "当前密码不正确，请重新输入。",
            },
          ],
        );
      }
      if (error.body?.code === "PASSWORD_TOO_SHORT") {
        throw new Problem("validation", "新密码至少需要 8 位。", 400);
      }
      if (error.body?.code === "PASSWORD_TOO_LONG") {
        throw new Problem("validation", "新密码不能超过 16 位。", 400);
      }
    }
    throw new Problem(
      "password_change_failed",
      "暂时无法修改密码，请稍后重试。",
      500,
    );
  }
  return { message: "密码已更新，其他设备已退出登录。" };
}
