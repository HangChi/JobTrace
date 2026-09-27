import "server-only";

import { deliverEmail } from "@/modules/identity-access";
import { getAuthEnv, getReminderEnv } from "@/shared/config/env";
import { asProblem } from "@/shared/errors/problem";
import { formatBeijingDateTime } from "../domain/reminder-rules";
import { PostgresReminderRepository } from "../infrastructure/postgres-reminder-repository";

export async function deliverDueReminders(limit?: number) {
  const config = getReminderEnv();
  const repository = new PostgresReminderRepository();
  const claims = await repository.claimDue(
    Math.min(limit ?? config.batchSize, config.batchSize),
    config.leaseSeconds,
    config.maxAttempts,
  );
  const baseUrl = getAuthEnv().BETTER_AUTH_URL.replace(/\/$/, "");
  const results = await Promise.all(
    claims.map(async (claim) => {
      try {
        await deliverEmail({
          to: claim.recipient!,
          template: "scheduled_reminder",
          companyName: claim.companyName,
          positionName: claim.positionName,
          title: claim.title,
          eventAt: formatBeijingDateTime(claim.eventAt),
          applicationUrl: `${baseUrl}/applications/${claim.applicationId}`,
        });
        await repository.finalizeClaim(
          claim.id,
          claim.notifyAt,
          claim.claimToken,
          { status: "sent" },
        );
        return "sent" as const;
      } catch (error) {
        const problem = asProblem(error);
        await repository.finalizeClaim(
          claim.id,
          claim.notifyAt,
          claim.claimToken,
          { status: "failed", errorCode: problem.code },
        );
        return "failed" as const;
      }
    }),
  );
  return {
    claimed: claims.length,
    sent: results.filter((status) => status === "sent").length,
    failed: results.filter((status) => status === "failed").length,
    skipped: 0,
  };
}
