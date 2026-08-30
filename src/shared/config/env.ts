import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL 必须使用 PostgreSQL 协议",
    ),
  DATABASE_APP_POOL_MAX: z.coerce.number().int().min(1).max(50).default(8),
  DATABASE_AUTH_POOL_MAX: z.coerce.number().int().min(1).max(20).default(2),
});

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  AUTH_CHALLENGE_VERIFY_URL: z.url().optional(),
  AUTH_CHALLENGE_SECRET: z.string().min(1).optional(),
  AUTH_EMAIL_DELIVERY_URL: z.url().optional(),
  AUTH_EMAIL_DELIVERY_SECRET: z.string().min(1).optional(),
  AUTH_EMAIL_VERIFICATION_TEST_CODE: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

const cosEnvSchema = z.object({
  COS_SECRET_ID: z.string().trim().min(1),
  COS_SECRET_KEY: z.string().trim().min(1),
  COS_BUCKET: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]*-\d+$/),
  COS_REGION: z
    .string()
    .trim()
    .regex(/^[a-z]+-[a-z0-9-]+$/),
  COS_PUBLIC_BASE_URL: z.url().optional(),
});

const jobMarketEnvSchema = z.object({
  JOB_MARKET_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  JOB_MARKET_SYNC_SECRET: z.string().min(32).optional(),
  JOB_MARKET_SYNC_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(10),
  JOB_MARKET_FETCH_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(30_000)
    .default(12_000),
  JOB_MARKET_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(10_485_760)
    .default(5_242_880),
  JOB_MARKET_WORKER_ID: z.string().trim().min(1).max(100).default("jobtrace"),
});

export type CosEnv = {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  publicBaseUrl?: string;
};

export function getDatabaseEnv() {
  return databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_APP_POOL_MAX: process.env.DATABASE_APP_POOL_MAX || undefined,
    DATABASE_AUTH_POOL_MAX: process.env.DATABASE_AUTH_POOL_MAX || undefined,
  });
}

export function getAuthEnv() {
  return authEnvSchema.parse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || undefined,
    AUTH_CHALLENGE_VERIFY_URL:
      process.env.AUTH_CHALLENGE_VERIFY_URL || undefined,
    AUTH_CHALLENGE_SECRET: process.env.AUTH_CHALLENGE_SECRET || undefined,
    AUTH_EMAIL_DELIVERY_URL: process.env.AUTH_EMAIL_DELIVERY_URL || undefined,
    AUTH_EMAIL_DELIVERY_SECRET:
      process.env.AUTH_EMAIL_DELIVERY_SECRET || undefined,
    AUTH_EMAIL_VERIFICATION_TEST_CODE:
      process.env.AUTH_EMAIL_VERIFICATION_TEST_CODE || undefined,
  });
}

export function getCosEnv(): CosEnv {
  const value = cosEnvSchema.parse({
    COS_SECRET_ID: process.env.COS_SECRET_ID,
    COS_SECRET_KEY: process.env.COS_SECRET_KEY,
    COS_BUCKET: process.env.COS_BUCKET,
    COS_REGION: process.env.COS_REGION,
    COS_PUBLIC_BASE_URL: process.env.COS_PUBLIC_BASE_URL || undefined,
  });
  return {
    secretId: value.COS_SECRET_ID,
    secretKey: value.COS_SECRET_KEY,
    bucket: value.COS_BUCKET,
    region: value.COS_REGION,
    publicBaseUrl: value.COS_PUBLIC_BASE_URL,
  };
}

export function hasAuthConfiguration() {
  return authEnvSchema.safeParse({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || undefined,
    AUTH_CHALLENGE_VERIFY_URL:
      process.env.AUTH_CHALLENGE_VERIFY_URL || undefined,
    AUTH_CHALLENGE_SECRET: process.env.AUTH_CHALLENGE_SECRET || undefined,
    AUTH_EMAIL_DELIVERY_URL: process.env.AUTH_EMAIL_DELIVERY_URL || undefined,
    AUTH_EMAIL_DELIVERY_SECRET:
      process.env.AUTH_EMAIL_DELIVERY_SECRET || undefined,
    AUTH_EMAIL_VERIFICATION_TEST_CODE:
      process.env.AUTH_EMAIL_VERIFICATION_TEST_CODE || undefined,
  }).success;
}

export function getJobMarketEnv() {
  const value = jobMarketEnvSchema.parse({
    JOB_MARKET_ENABLED: process.env.JOB_MARKET_ENABLED || undefined,
    JOB_MARKET_SYNC_SECRET: process.env.JOB_MARKET_SYNC_SECRET || undefined,
    JOB_MARKET_SYNC_BATCH_SIZE:
      process.env.JOB_MARKET_SYNC_BATCH_SIZE || undefined,
    JOB_MARKET_FETCH_TIMEOUT_MS:
      process.env.JOB_MARKET_FETCH_TIMEOUT_MS || undefined,
    JOB_MARKET_MAX_RESPONSE_BYTES:
      process.env.JOB_MARKET_MAX_RESPONSE_BYTES || undefined,
    JOB_MARKET_WORKER_ID: process.env.JOB_MARKET_WORKER_ID || undefined,
  });
  if (value.JOB_MARKET_ENABLED && !value.JOB_MARKET_SYNC_SECRET) {
    throw new Error(
      "JOB_MARKET_SYNC_SECRET is required when JOB_MARKET_ENABLED=true",
    );
  }
  return {
    enabled: value.JOB_MARKET_ENABLED,
    syncSecret: value.JOB_MARKET_SYNC_SECRET,
    syncBatchSize: value.JOB_MARKET_SYNC_BATCH_SIZE,
    fetchTimeoutMs: value.JOB_MARKET_FETCH_TIMEOUT_MS,
    maxResponseBytes: value.JOB_MARKET_MAX_RESPONSE_BYTES,
    workerId: value.JOB_MARKET_WORKER_ID,
  };
}
