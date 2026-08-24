import { z } from "zod";
import {
  INTERVIEW_FORMATS,
  INTERVIEW_STAGES,
  QUESTION_CATEGORIES,
  REVIEW_STATUSES,
  ROUND_RESULTS,
} from "./catalog";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const questionInputSchema = z.object({
  id: z.uuid().nullable().optional(),
  category: z.enum(QUESTION_CATEGORIES).default("other"),
  question: z.string().trim().min(1, "请输入面试问题").max(4000),
  originalAnswer: optionalText(10000),
  followUpNotes: optionalText(10000),
  improvedAnswer: optionalText(10000),
  selfRating: z.number().int().min(1).max(5).nullable().optional(),
});

export const actionItemInputSchema = z.object({
  id: z.uuid().nullable().optional(),
  content: z.string().trim().min(1, "请输入行动内容").max(1000),
  completed: z.boolean().default(false),
});

export const createInterviewSchema = z
  .object({
    applicationId: z.uuid(),
    stageOccurrenceId: z.uuid().nullable().optional(),
    stage: z.enum(INTERVIEW_STAGES).optional(),
    stageOccurredOn: z.iso.date().optional(),
    interviewedOn: z.iso.date().optional(),
    format: z.enum(INTERVIEW_FORMATS).nullable().optional(),
    durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
    interviewerNotes: optionalText(2000),
    roundResult: z.enum(ROUND_RESULTS).default("pending"),
  })
  .superRefine((value, context) => {
    const existing = Boolean(value.stageOccurrenceId);
    const newStage = Boolean(value.stage && value.interviewedOn);
    if (existing === newStage) {
      context.addIssue({
        code: "custom",
        path: ["stageOccurrenceId"],
        message: "请选择已有面试阶段，或填写新的轮次和日期",
      });
    }
  });

export const updateInterviewSchema = z.object({
  version: z.number().int().positive(),
  interviewedOn: z.iso.date().optional(),
  format: z.enum(INTERVIEW_FORMATS).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  interviewerNotes: optionalText(2000),
  roundResult: z.enum(ROUND_RESULTS).default("pending"),
  highlights: optionalText(10000),
  gaps: optionalText(10000),
  status: z.enum(REVIEW_STATUSES).default("draft"),
  questions: z.array(questionInputSchema).max(200).default([]),
  actionItems: z.array(actionItemInputSchema).max(100).default([]),
});

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;
export type ActionItemInput = z.infer<typeof actionItemInputSchema>;
