import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverEmail } from "@/modules/identity-access/infrastructure/email-delivery.server";

const verificationPayload = {
  to: "user@example.com",
  template: "email_verification_code" as const,
  code: "123456",
  expiresInSeconds: 600,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("email delivery", () => {
  it("maps an invalid verification recipient to an email field error", async () => {
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-secret-at-least-thirty-two-bytes-long",
    );
    vi.stubEnv("AUTH_EMAIL_DELIVERY_URL", "https://mailer.example/deliver");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "invalid_recipient" }, { status: 422 }),
        ),
    );

    await expect(deliverEmail(verificationPayload)).rejects.toMatchObject({
      code: "invalid_recipient",
      status: 422,
      fieldErrors: [
        expect.objectContaining({ field: "email", code: "invalid_recipient" }),
      ],
    });
  });

  it("keeps password-reset delivery failures generic", async () => {
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-secret-at-least-thirty-two-bytes-long",
    );
    vi.stubEnv("AUTH_EMAIL_DELIVERY_URL", "https://mailer.example/deliver");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "invalid_recipient" }, { status: 422 }),
        ),
    );

    await expect(
      deliverEmail({
        to: "user@example.com",
        template: "password_reset",
        resetUrl: "https://jobtrace.example/reset-password?token=test",
        expiresInSeconds: 3600,
      }),
    ).rejects.toMatchObject({
      code: "email_delivery_failed",
      status: 502,
    });
  });
});
