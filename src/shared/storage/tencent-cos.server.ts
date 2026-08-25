import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";
import type { CosEnv } from "@/shared/config/env";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function hmacSha1(key: string, value: string) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function cosAuthorization({
  method,
  url,
  secretId,
  secretKey,
  now = new Date(),
}: {
  method: string;
  url: URL;
  secretId: string;
  secretKey: string;
  now?: Date;
}) {
  const start = Math.floor(now.getTime() / 1000) - 60;
  const keyTime = `${start};${start + 660}`;
  const headerList = "host";
  const headerString = `host=${encodeURIComponent(url.host)}`;
  const httpString = `${method.toLowerCase()}\n${url.pathname}\n\n${headerString}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signKey = hmacSha1(secretKey, keyTime);
  const signature = hmacSha1(signKey, stringToSign);

  return [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");
}

function objectPath(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function avatarObjectKey(userId: string, mimeType: string) {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) return null;
  return `avatars/${userId}/${randomUUID()}.${extension}`;
}

export function hasImageSignature(body: ArrayBuffer, mimeType: string) {
  const bytes = new Uint8Array(body);
  if (mimeType === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  if (mimeType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/gif") {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

export async function uploadCosObject({
  body,
  contentType,
  key,
  config,
}: {
  body: ArrayBuffer;
  contentType: string;
  key: string;
  config: CosEnv;
}) {
  const endpoint = new URL(
    `https://${config.bucket}.cos.${config.region}.myqcloud.com/`,
  );
  const uploadUrl = new URL(objectPath(key), endpoint);
  const authorization = cosAuthorization({
    method: "PUT",
    url: uploadUrl,
    secretId: config.secretId,
    secretKey: config.secretKey,
  });
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const bodyPreview = (await response.text()).slice(0, 300);
    console.error("Tencent COS avatar upload failed", {
      status: response.status,
      requestId: response.headers.get("x-cos-request-id"),
      body: bodyPreview,
    });
    throw new Error(`COS upload failed with status ${response.status}`);
  }

  const publicBaseUrl =
    config.publicBaseUrl ??
    `https://${config.bucket}.cos.${config.region}.myqcloud.com`;
  return `${publicBaseUrl.replace(/\/$/, "")}/${objectPath(key)}`;
}
