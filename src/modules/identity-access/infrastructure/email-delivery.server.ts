import "server-only";

import { getAuthEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";

type DeliveryPayload =
  | {
      to: string;
      template: "password_reset";
      resetUrl: string;
      expiresInSeconds: number;
    }
  | {
      to: string;
      template: "email_verification_code";
      code: string;
      expiresInSeconds: number;
    };

export async function deliverEmail(payload: DeliveryPayload) {
  const env = getAuthEnv();
  if (!env.AUTH_EMAIL_DELIVERY_URL) {
    throw new Problem(
      "email_delivery_unavailable",
      "邮件服务暂不可用，请稍后再试。",
      503,
    );
  }
  const response = await fetch(env.AUTH_EMAIL_DELIVERY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.AUTH_EMAIL_DELIVERY_SECRET
        ? { authorization: `Bearer ${env.AUTH_EMAIL_DELIVERY_SECRET}` }
        : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Problem(
      "email_delivery_failed",
      "邮件发送失败，请稍后重试。",
      502,
    );
  }
}
