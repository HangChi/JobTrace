import "server-only";

import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { getAuthEnv, getDatabaseEnv } from "@/shared/config/env";

const database = new Pool({ connectionString: getDatabaseEnv().DATABASE_URL });
const authEnv = getAuthEnv();

async function sendResetPassword({
  user,
  url,
}: {
  user: { id: string };
  url: string;
}) {
  if (!authEnv.AUTH_EMAIL_DELIVERY_URL) return;
  const [target] = await database
    .query<{ recovery_email: string | null }>(
      "select recovery_email from public.users where id=$1",
      [user.id],
    )
    .then((result) => result.rows);
  if (!target?.recovery_email) return;
  const response = await fetch(authEnv.AUTH_EMAIL_DELIVERY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authEnv.AUTH_EMAIL_DELIVERY_SECRET
        ? { authorization: `Bearer ${authEnv.AUTH_EMAIL_DELIVERY_SECRET}` }
        : {}),
    },
    body: JSON.stringify({
      to: target.recovery_email,
      template: "password_reset",
      resetUrl: url,
      expiresInSeconds: 3600,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("password reset delivery failed");
}

export const auth = betterAuth({
  appName: "JobTrace",
  baseURL: authEnv.BETTER_AUTH_URL,
  secret: authEnv.BETTER_AUTH_SECRET,
  advanced: {
    useSecureCookies:
      process.env.NODE_ENV === "production" ||
      authEnv.BETTER_AUTH_URL.startsWith("https://"),
  },
  database,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 16,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-in/username": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  user: {
    modelName: "users",
    fields: {
      name: "display_name",
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "verification_tokens",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    storeIdentifier: "hashed",
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      schema: {
        user: {
          fields: {
            username: "username",
            displayUsername: "display_username",
          },
        },
      },
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      schema: {
        user: {
          fields: {
            banned: "disabled",
            banReason: "ban_reason",
            banExpires: "ban_expires",
          },
        },
        session: { fields: { impersonatedBy: "impersonated_by" } },
      },
    }),
    nextCookies(),
  ],
});
