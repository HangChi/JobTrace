import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL 必须使用 PostgreSQL 协议",
    ),
});

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  AUTH_CHALLENGE_VERIFY_URL: z.url().optional(),
  AUTH_CHALLENGE_SECRET: z.string().min(1).optional(),
});

export function getDatabaseEnv() {
  return databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}

export function getAuthEnv() {
  return authEnvSchema.parse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_CHALLENGE_VERIFY_URL: process.env.AUTH_CHALLENGE_VERIFY_URL,
    AUTH_CHALLENGE_SECRET: process.env.AUTH_CHALLENGE_SECRET,
  });
}

export function hasAuthConfiguration() {
  return authEnvSchema.safeParse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_CHALLENGE_VERIFY_URL: process.env.AUTH_CHALLENGE_VERIFY_URL,
    AUTH_CHALLENGE_SECRET: process.env.AUTH_CHALLENGE_SECRET,
  }).success;
}
