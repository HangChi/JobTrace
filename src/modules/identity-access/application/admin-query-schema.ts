import { z } from "zod";

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(50);
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z.string().max(max).optional(),
  );
const optionalDate = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.iso.date().optional(),
);

function orderedRange(from: string, to: string) {
  return (value: Record<string, unknown>, context: z.RefinementCtx) => {
    const start = value[from] as string | undefined;
    const end = value[to] as string | undefined;
    if (start && end && start > end) {
      context.addIssue({
        code: "custom",
        path: [String(to)],
        message: "结束日期不能早于开始日期。",
      });
    }
  };
}

const userQueryShape = {
  q: optionalText(100),
  role: z.enum(["all", "user", "admin"]).default("all"),
  status: z.enum(["all", "active", "disabled"]).default("all"),
  registeredFrom: optionalDate,
  registeredTo: optionalDate,
  page,
  limit,
};
export const adminUserQuerySchema = z
  .object(userQueryShape)
  .superRefine(orderedRange("registeredFrom", "registeredTo"));

const auditQueryShape = {
  actor: optionalText(100),
  target: optionalText(100),
  eventType: z
    .enum([
      "all",
      "promote_admin",
      "demote_admin",
      "disable_user",
      "enable_user",
    ])
    .default("all"),
  outcome: z
    .enum(["all", "succeeded", "denied", "conflict", "failed"])
    .default("all"),
  occurredFrom: optionalDate,
  occurredTo: optionalDate,
  page,
  limit,
};
export const adminAuditQuerySchema = z
  .object(auditQueryShape)
  .superRefine(orderedRange("occurredFrom", "occurredTo"));

export const adminUserContentQuerySchema = z.object({
  applicationsPage: z.coerce.number().int().min(1).default(1),
  interviewsPage: z.coerce.number().int().min(1).default(1),
});

export const adminAccessActions = [
  "promote_admin",
  "demote_admin",
  "disable_user",
  "enable_user",
] as const;

export const accessChangeSchema = z.object({
  requestId: z.uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  action: z.enum(adminAccessActions),
  reason: z.string().trim().min(10).max(500),
  confirmSelf: z.boolean().optional().default(false),
});

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;
export type AdminUserContentQuery = z.infer<typeof adminUserContentQuerySchema>;
export type AccessChangeInput = z.infer<typeof accessChangeSchema>;
export type AdminAccessAction = AccessChangeInput["action"];
