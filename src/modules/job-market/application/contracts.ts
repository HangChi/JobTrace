import { z } from "zod";
import { SOURCE_ADAPTERS } from "../domain/entities";

export const campaignIdSchema = z.uuid();
export const sourceIdSchema = z.uuid();
export const campaignQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  company: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  status: z.enum(["open", "stale", "closed"]).optional(),
  postedFrom: z.iso.date().optional(),
  favorite: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const internalSyncSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(10),
});

export const sourceDiscoveryScanSchema = z.object({
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const sourceCandidateIdSchema = z.uuid();

export const sourceCandidateReviewSchema = z.object({
  action: z.enum(["approve", "ignore"]),
});

export const sourceInputSchema = z.object({
  companyId: z.uuid(),
  adapter: z.enum(SOURCE_ADAPTERS),
  externalKey: z.string().trim().min(1).max(200),
  baseUrl: z.url().refine((url) => url.startsWith("https://")),
  allowedHosts: z.array(z.string().trim().min(1).max(253)).min(1).max(10),
  countryCodes: z
    .array(z.string().regex(/^[a-z]{2}$/))
    .max(10)
    .default([]),
  accessBasis: z.enum(["public", "authorized"]),
  isOfficial: z.boolean().default(true),
  syncIntervalMinutes: z.number().int().min(60).max(1440).default(360),
});

export const sourceUpdateSchema = z
  .object({
    status: z.enum(["active", "paused", "revoked"]).optional(),
    syncIntervalMinutes: z.number().int().min(60).max(1440).optional(),
    accessBasis: z.enum(["public", "authorized"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "至少提供一个更新字段");
