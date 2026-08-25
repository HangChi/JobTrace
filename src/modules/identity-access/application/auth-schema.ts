import { z } from "zod";

export const emailSchema = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "用户名至少需要 3 位")
  .max(30, "用户名不能超过 30 位")
  .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线")
  .transform((value) => value.toLowerCase());
export const passwordSchema = z
  .string()
  .min(8, "密码至少需要 8 位")
  .max(16, "密码不能超过 16 位");
export const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "请输入 6 位邮箱验证码");

const displayNameSchema = z
  .union([
    z.string().trim().min(1).max(100, "昵称不能超过 100 个字符"),
    z.literal(""),
  ])
  .optional()
  .transform((value) => value || undefined);

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  verificationCode: verificationCodeSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

export const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1, "请再次输入密码"),
    returnTo: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "两次输入的密码不一致",
      });
    }
  });

export const loginSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object") return input;
    const value = input as Record<string, unknown>;
    return { ...value, identifier: value.identifier ?? value.username };
  },
  z.object({
    identifier: z
      .string()
      .trim()
      .min(1, "请输入邮箱或用户名")
      .max(254)
      .transform((value) => value.toLowerCase())
      .refine(
        (value) =>
          value.includes("@")
            ? emailSchema.safeParse(value).success
            : usernameSchema.safeParse(value).success,
        "请输入有效的邮箱或用户名",
      ),
    password: z.string().min(1).max(128),
    returnTo: z.string().optional(),
  }),
);

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
