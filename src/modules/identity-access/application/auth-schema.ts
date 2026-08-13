import { z } from "zod";

export const emailSchema = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/)
  .transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
  returnTo: z.string().optional(),
});

export function safeReturnTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "http://local");
    return url.origin === "http://local"
      ? `${url.pathname}${url.search}`
      : null;
  } catch {
    return null;
  }
}
