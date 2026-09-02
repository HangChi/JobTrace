import { z } from "zod";
import {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  RECRUITMENT_STAGES,
} from "./catalog";

const date = z.iso.date();
const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
export const stageInputSchema = z.object({
  stage: z.enum(RECRUITMENT_STAGES),
  occurredOn: date,
});
export const stageUpdateSchema = stageInputSchema.extend({ changeDate: date });
export const createApplicationSchema = z.object({
  jobMarketPostId: z.uuid().optional(),
  companyName: z.string().trim().min(1, "请输入公司名称").max(200),
  positionName: z.string().trim().min(1, "请输入岗位名称").max(200),
  city: optionalText(100),
  jobUrl: z
    .union([z.url({ protocol: /^https?$/ }).max(2048), z.literal(""), z.null()])
    .optional(),
  appliedDate: date,
  type: z.enum(APPLICATION_TYPES).default("campus_recruitment"),
  status: z.enum(APPLICATION_STATUSES).default("submitted"),
  notes: optionalText(10000),
  stages: z.array(stageInputSchema).max(100).default([]),
});
export const updateApplicationSchema = createApplicationSchema
  .extend({ version: z.number().int().positive(), changeDate: date })
  .refine((v) => v.changeDate >= v.appliedDate, {
    path: ["changeDate"],
    message: "变更日期不能早于投递日期",
  });
export const updateApplicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  version: z.number().int().positive(),
});
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<
  typeof updateApplicationStatusSchema
>;
