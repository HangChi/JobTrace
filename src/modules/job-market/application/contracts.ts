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

export const wechatCollectSchema = z.object({
  queries: z
    .array(z.string().trim().min(2).max(30))
    .max(6)
    .optional(),
});

export const companyCandidateIdSchema = z.uuid();

export const companyCandidateReviewSchema = z.object({
  action: z.enum(["approve", "ignore"]),
  companyName: z.string().trim().min(2).max(60).optional(),
  companyType: z.enum(["企业", "民营企业", "上市公司", "国有企业", "中央企业", "事业单位", "外企"]).optional(),
  industry: z.string().trim().min(2).max(60).optional(),
});

export const defaultCatalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type DefaultCatalogItem = {
  identityKey?: string;
  companyName: string;
  adapter?: string;
  industry: string;
  websiteUrl: string;
  channel?: "automatic" | "official_site" | "wechat";
  channelLabel?: string;
};

export type DefaultCatalogSummary = {
  total: number;
  automatic: number;
  directory: number;
};

export type DefaultCatalogPage = {
  items: DefaultCatalogItem[];
  page: number;
  limit: number;
  total: number;
};

export type SourceCandidate = {
  id: string;
  companyId: string;
  companyName: string;
  companyType: string | null;
  entryUrl: string;
  adapter: (typeof SOURCE_ADAPTERS)[number] | null;
  externalKey: string | null;
  baseUrl: string | null;
  allowedHosts: string[];
  confidence: "high" | "medium" | null;
  evidenceCode: string;
  reviewStatus: "unrecognized" | "pending" | "approved" | "ignored";
  healthStatus: "healthy" | "unreachable" | "unsupported";
  diagnosticCode: string | null;
  diagnosticSummary: string | null;
  httpStatus: number | null;
  approvedSourceId: string | null;
  lastCheckedAt: string;
};

export type CompanyCandidate = {
  id: string;
  companyName: string;
  articleUrl: string;
  articleTitle: string;
  snippet: string | null;
  publishedAt: string | null;
  sourceEngine: "sogou" | "bing" | "site_scan";
  articleCount: number;
  detectedAdapter: string | null;
  detectedConfidence: string | null;
  reviewStatus: "pending" | "approved" | "ignored";
  createdCompanyId: string | null;
  createdAt: string;
};

export type CompanyCandidateList = {
  items: CompanyCandidate[];
  summary: {
    pending: number;
    approved: number;
    ignored: number;
  };
};

export type WechatCollectionResult = {
  engines: Array<{
    engine: "sogou" | "bing";
    status: "ok" | "blocked" | "error";
    articles: number;
    detail: string | null;
  }>;
  extracted: number;
  knownCompanies: number;
  queued: number;
  candidates: number;
};

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
