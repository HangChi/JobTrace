import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { IdentityBridgeActor } from "./identity-bridge-actor.server";

const bridgeConfigSchema = z.object({
  issuer: z.string().trim().min(1).max(128),
  audience: z.string().trim().min(1).max(128),
  keyId: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  secret: z.string().regex(/^[A-Za-z0-9_-]{43,256}$/),
});

export type IdentityBridgeConfig = z.infer<typeof bridgeConfigSchema>;

export type IdentityBridgeRequest = {
  actor: IdentityBridgeActor;
  requestId: string;
  method: "GET";
  path: "/api/analytics/summary";
};

export function getIdentityBridgeConfig(): IdentityBridgeConfig {
  const config = bridgeConfigSchema.parse({
    issuer: process.env.IDENTITY_BRIDGE_ISSUER,
    audience: process.env.IDENTITY_BRIDGE_AUDIENCE,
    keyId: process.env.IDENTITY_BRIDGE_ACTIVE_KEY_ID,
    secret: process.env.IDENTITY_BRIDGE_ACTIVE_SECRET,
  });
  decodeSecret(config.secret);
  return config;
}

export function issueIdentityBridgeAssertion(
  request: IdentityBridgeRequest,
  config: IdentityBridgeConfig = getIdentityBridgeConfig(),
  now: Date = new Date(),
) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = encodeJson({ alg: "HS256", kid: config.keyId, typ: "JWT" });
  const payload = encodeJson({
    ver: 1,
    iss: config.issuer,
    aud: config.audience,
    sub: request.actor.id,
    role: request.actor.role,
    av: request.actor.accessVersion,
    rid: request.requestId,
    mth: request.method,
    pth: request.path,
    iat: issuedAt,
    nbf: issuedAt,
    exp: issuedAt + 30,
    jti: randomBytes(16).toString("base64url"),
  });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", decodeSecret(config.secret))
    .update(signingInput, "ascii")
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

function encodeJson(value: object) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeSecret(value: string) {
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length < 32 || decoded.toString("base64url") !== value) {
    throw new Error("Identity bridge secret must be canonical base64url");
  }
  return decoded;
}
