import { createHash } from "node:crypto";
import type { NormalizedJob, NormalizedLocation } from "./entities";

export function normalizeText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function plainText(value: string | null | undefined, max = 50_000) {
  if (!value) return null;
  const text = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, max) : null;
}

export function normalizeLocation(value: string): NormalizedLocation {
  const name = value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  const key = normalizeText(name).replace(/[，,、/]+/g, "|");
  return {
    name,
    normalizedKey: key,
    isRemote: /远程|remote|anywhere/i.test(name),
  };
}

export function uniqueLocations(values: string[]) {
  return [
    ...new Map(
      values
        .map(normalizeLocation)
        .filter((item) => item.normalizedKey)
        .map((item) => [item.normalizedKey, item]),
    ).values(),
  ];
}

export function safeDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function canonicalHttpsUrl(
  value: string | null | undefined,
  options?: { preserveHash?: boolean },
) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!options?.preserveHash) url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_|^(ref|source|tracking)$/i.test(key))
        url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
}

export function campaignKey(input: {
  explicit?: string | null;
  sourceKey: string;
  recruitmentType?: string | null;
}) {
  const value = input.explicit
    ? `explicit:${normalizeText(input.explicit)}`
    : `fallback:${normalizeText(input.sourceKey)}:${normalizeText(input.recruitmentType || "unspecified")}`;
  return createHash("sha256").update(value).digest("hex");
}

export function contentHash(value: Omit<NormalizedJob, "contentHash">) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...value,
        locations: [...value.locations].sort((a, b) =>
          a.normalizedKey.localeCompare(b.normalizedKey),
        ),
      }),
    )
    .digest("hex");
}
