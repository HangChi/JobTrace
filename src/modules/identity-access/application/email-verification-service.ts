import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { createServerDatabase } from "@/shared/database";
import { getAuthEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
import { emailSchema, verificationCodeSchema } from "./auth-schema";
import { requireUser } from "./authorization";
import { auth } from "../infrastructure/better-auth.server";
import { deliverEmail } from "../infrastructure/email-delivery.server";
import { checkAuthRateLimit } from "../infrastructure/auth-rate-limit";

type Purpose = "registration" | "email_binding";
const CODE_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;

function codeHash(
  email: string,
  code: string,
  purpose: Purpose,
  userId?: string,
) {
  return createHmac("sha256", getAuthEnv().BETTER_AUTH_SECRET)
    .update(`${purpose}\0${userId ?? ""}\0${email}\0${code}`)
    .digest("hex");
}

function testCode() {
  const env = getAuthEnv();
  return process.env.NODE_ENV === "production"
    ? undefined
    : env.AUTH_EMAIL_VERIFICATION_TEST_CODE;
}

export async function requestEmailVerificationCode(
  rawEmail: unknown,
  purpose: Purpose,
  rateKey: string,
  userId?: string,
) {
  const email = emailSchema.parse(rawEmail);
  await checkAuthRateLimit(rateKey, "email-code-ip", 20, 60 * 60_000);
  await checkAuthRateLimit(email, "email-code-address", 5, 60 * 60_000);
  await checkAuthRateLimit(email, "email-code-cooldown", 1, 60_000);
  const sql = createServerDatabase();
  const [conflict] = await sql<{ id: string }[]>`
    select id from public.users
    where lower(recovery_email)=lower(${email})
      ${userId ? sql`and id<>${userId}` : sql``}
    limit 1
  `;
  if (conflict) {
    if (purpose === "registration") {
      return { message: "如果该邮箱可用，验证码将发送到该邮箱。" };
    }
    throw new Problem("email_conflict", "该邮箱已绑定其他账号。", 409);
  }

  const code =
    testCode() ?? randomInt(0, 1_000_000).toString().padStart(6, "0");
  await sql.begin(async (transaction) => {
    await transaction`
      update public.email_verification_codes set consumed_at=now()
      where lower(email)=lower(${email}) and purpose=${purpose}
        and user_id is not distinct from ${userId ?? null}
        and consumed_at is null
    `;
    await transaction`
      insert into public.email_verification_codes(
        email,purpose,user_id,code_hash,expires_at
      ) values(
        ${email},${purpose},${userId ?? null},
        ${codeHash(email, code, purpose, userId)},
        now()+make_interval(secs => ${CODE_TTL_SECONDS})
      )
    `;
  });
  if (!testCode()) {
    await deliverEmail({
      to: email,
      template: "email_verification_code",
      code,
      expiresInSeconds: CODE_TTL_SECONDS,
    });
  }
  return { message: "验证码已发送，10 分钟内有效。" };
}

export async function verifyEmailCode(
  rawEmail: unknown,
  rawCode: unknown,
  purpose: Purpose,
  userId?: string,
) {
  const email = emailSchema.parse(rawEmail);
  const code = verificationCodeSchema.parse(rawCode);
  if (testCode() === code) return { id: null, email };
  const sql = createServerDatabase();
  const [row] = await sql<
    Array<{ id: string; codeHash: string; attemptCount: number }>
  >`
    select id,code_hash,attempt_count
    from public.email_verification_codes
    where lower(email)=lower(${email}) and purpose=${purpose}
      and user_id is not distinct from ${userId ?? null}
      and consumed_at is null and expires_at>now()
      and attempt_count<${MAX_ATTEMPTS}
    order by created_at desc limit 1
  `;
  const expected = row?.codeHash ?? "0".repeat(64);
  const actual = codeHash(email, code, purpose, userId);
  const matches = timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  if (!row || !matches) {
    if (row) {
      await sql`
        update public.email_verification_codes
        set attempt_count=attempt_count+1 where id=${row.id}
      `;
    }
    throw new Problem("invalid_email_code", "邮箱验证码无效或已过期。", 400, [
      {
        field: "verificationCode",
        code: "invalid_email_code",
        message: "请检查验证码，或重新获取。",
      },
    ]);
  }
  return { id: row.id as string | null, email };
}

async function verifyCurrentPassword(password: unknown) {
  const value = z
    .string({ error: "请输入当前密码。" })
    .min(1, "请输入当前密码。")
    .max(128, "当前密码格式不正确。")
    .parse(password);
  try {
    await auth.api.verifyPassword({
      body: { password: value },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      throw new Problem("invalid_password", "当前密码不正确。", 400);
    }
    throw error;
  }
}

export async function requestRegistrationEmailCode(
  email: unknown,
  rateKey: string,
) {
  return requestEmailVerificationCode(email, "registration", rateKey);
}

export async function requestEmailBindingCode(email: unknown, rateKey: string) {
  const actor = await requireUser();
  return requestEmailVerificationCode(
    email,
    "email_binding",
    rateKey,
    actor.id,
  );
}

export async function bindEmail(input: unknown) {
  const actor = await requireUser();
  const value = input as Record<string, unknown>;
  await checkAuthRateLimit(actor.id, "email-change", 5, 15 * 60_000);
  await verifyCurrentPassword(value.currentPassword);
  const verification = await verifyEmailCode(
    value.email,
    value.verificationCode,
    "email_binding",
    actor.id,
  );
  const sql = createServerDatabase();
  try {
    await sql.begin(async (transaction) => {
      await transaction`
        update public.users set
          recovery_email=${verification.email},
          recovery_email_verified_at=now(),
          email_verified=true,
          updated_at=now()
        where id=${actor.id}
      `;
      if (verification.id) {
        await transaction`
          update public.email_verification_codes
          set consumed_at=now() where id=${verification.id}
        `;
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Problem("email_conflict", "该邮箱已绑定其他账号。", 409);
    }
    throw error;
  }
  return { email: verification.email, emailVerified: true };
}

export async function unbindEmail(input: unknown) {
  const actor = await requireUser();
  const value = input as Record<string, unknown>;
  await checkAuthRateLimit(actor.id, "email-change", 5, 15 * 60_000);
  await verifyCurrentPassword(value.currentPassword);
  const sql = createServerDatabase();
  await sql.begin(async (transaction) => {
    await transaction`
      update public.users set recovery_email=null,
        recovery_email_verified_at=null,email_verified=false,updated_at=now()
      where id=${actor.id}
    `;
    await transaction`
      update public.email_verification_codes set consumed_at=now()
      where user_id=${actor.id} and consumed_at is null
    `;
  });
  return { email: null, emailVerified: false };
}
