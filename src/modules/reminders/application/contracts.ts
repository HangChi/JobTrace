import { z } from "zod";

export const reminderStatuses = [
  "pending",
  "due",
  "completed",
  "cancelled",
] as const;
export type ReminderStatus = (typeof reminderStatuses)[number];

export const notificationAttemptStatuses = [
  "claimed",
  "sent",
  "failed",
  "skipped",
] as const;
export type NotificationAttemptStatus =
  (typeof notificationAttemptStatuses)[number];

const dateTime = z.iso.datetime({ offset: true });
export const reminderInputSchema = z.object({
  applicationId: z.uuid(),
  sourceStageOccurrenceId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1, "请输入待办内容。").max(120),
  eventAt: dateTime,
  notifyAt: dateTime,
  emailEnabled: z.boolean().default(false),
});
export const reminderUpdateSchema = reminderInputSchema.extend({
  version: z.number().int().positive(),
});
export const versionSchema = z.object({ version: z.number().int().positive() });
export const snoozeSchema = versionSchema.extend({ notifyAt: dateTime });
export const reopenSchema = versionSchema.extend({
  eventAt: dateTime,
  notifyAt: dateTime,
});
export const reminderDeliverySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});
export const suggestionResolutionSchema = z.object({
  resolution: z.enum(["completed", "dismissed"]),
});
export const reminderPreferencesSchema = z.object({
  homeEnabled: z.boolean(),
  homeView: z.enum(["scheduled", "suggestions"]),
  defaultLead: z.enum(["on_time", "30m", "1h", "1d"]),
  defaultSnoozeMinutes: z.union([
    z.literal(30),
    z.literal(60),
    z.literal(1440),
  ]),
  emailDefault: z.boolean(),
});

export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type Reminder = {
  id: string;
  applicationId: string;
  sourceStageOccurrenceId: string | null;
  companyName: string;
  positionName: string;
  title: string;
  eventAt: string;
  notifyAt: string;
  emailEnabled: boolean;
  status: ReminderStatus;
  version: number;
  emailStatus: NotificationAttemptStatus | null;
  completedAt: string | null;
  cancelledAt: string | null;
};
export type ReminderEmailAvailability = {
  available: boolean;
  address: string | null;
};
export type ReminderPreferences = z.infer<typeof reminderPreferencesSchema>;
export type ReminderSummary = {
  overdue: Reminder[];
  upcoming: Reminder[];
  history: Reminder[];
  email: ReminderEmailAvailability;
};
export type DeliveryClaim = Reminder & {
  claimToken: string;
  recipient: string | null;
};
