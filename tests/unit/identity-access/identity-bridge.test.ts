import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/modules/identity-access/application/authorization", () => ({
  requireUser: mocks.requireUser,
}));
vi.mock("@/shared/database", () => ({
  createServerDatabase:
    () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      mocks.query(parts, values),
}));

import { getIdentityBridgeActor } from "@/modules/identity-access/infrastructure/identity-bridge-actor.server";
import { issueIdentityBridgeAssertion } from "@/modules/identity-access/infrastructure/identity-bridge.server";

const currentConfig = {
  issuer: "legacy-jobtrace",
  audience: "jobtrace-java",
  keyId: "2026-10-current",
  secret: Buffer.alloc(32, 1).toString("base64url"),
};
const request = {
  actor: { id: "owner-a", role: "admin" as const, accessVersion: 7 },
  requestId: "0199a55c-9b00-7000-8000-000000000001",
  method: "GET" as const,
  path: "/api/analytics/summary" as const,
};

beforeEach(() => {
  mocks.requireUser.mockResolvedValue({ id: "owner-a" });
  mocks.query.mockResolvedValue([
    { role: "admin", disabled: false, accessVersion: 7 },
  ]);
});

afterEach(() => vi.restoreAllMocks());

describe("identity bridge actor", () => {
  test("reads current authorization state after session validation", async () => {
    await expect(getIdentityBridgeActor()).resolves.toEqual({
      id: "owner-a",
      role: "admin",
      accessVersion: 7,
    });
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  test("refuses a user disabled after the session was created", async () => {
    mocks.query.mockResolvedValue([
      { role: "user", disabled: true, accessVersion: 8 },
    ]);
    await expect(getIdentityBridgeActor()).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    });
  });

  test("fails closed when current authorization state is invalid", async () => {
    mocks.query.mockResolvedValue([
      { role: "unexpected", disabled: false, accessVersion: 8 },
    ]);
    await expect(getIdentityBridgeActor()).rejects.toThrow(
      "Invalid current account role",
    );
  });
});

describe("identity bridge issuer", () => {
  test("issues the exact 30-second request-bound v1 claim set", () => {
    const token = issueIdentityBridgeAssertion(
      request,
      currentConfig,
      new Date("2026-10-01T08:00:00Z"),
    );
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    const header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString("utf8"),
    );
    const claims = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    const expectedSignature = createHmac(
      "sha256",
      Buffer.from(currentConfig.secret, "base64url"),
    )
      .update(`${encodedHeader}.${encodedPayload}`, "ascii")
      .digest("base64url");

    expect(header).toEqual({
      alg: "HS256",
      kid: currentConfig.keyId,
      typ: "JWT",
    });
    expect(claims).toMatchObject({
      ver: 1,
      iss: "legacy-jobtrace",
      aud: "jobtrace-java",
      sub: "owner-a",
      role: "admin",
      av: 7,
      rid: request.requestId,
      mth: "GET",
      pth: "/api/analytics/summary",
      iat: 1790841600,
      nbf: 1790841600,
      exp: 1790841630,
    });
    expect(Buffer.from(claims.jti, "base64url")).toHaveLength(16);
    expect(signature).toBe(expectedSignature);
  });

  test("supports active-key rotation without ever logging secrets", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const previousConfig = {
      ...currentConfig,
      keyId: "2026-09-previous",
      secret: Buffer.alloc(32, 2).toString("base64url"),
    };

    const current = issueIdentityBridgeAssertion(request, currentConfig);
    const previous = issueIdentityBridgeAssertion(request, previousConfig);

    expect(decodeHeader(current).kid).toBe("2026-10-current");
    expect(decodeHeader(previous).kid).toBe("2026-09-previous");
    expect(current).not.toBe(previous);
    expect(log).not.toHaveBeenCalled();
  });

  test("rejects non-canonical or undersized secrets", () => {
    expect(() =>
      issueIdentityBridgeAssertion(request, {
        ...currentConfig,
        secret: Buffer.alloc(16, 1).toString("base64url"),
      }),
    ).toThrow(/secret/i);
  });
});

function decodeHeader(token: string) {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
}
