import { afterEach, describe, expect, it, vi } from "vitest";
import {
  avatarObjectKey,
  uploadCosObject,
} from "@/shared/storage/tencent-cos.server";

const config = {
  secretId: "AKIDexample",
  secretKey: "secret-key",
  bucket: "project-1308913859",
  region: "ap-shanghai",
  publicBaseUrl: "https://project-1308913859.cos.ap-shanghai.myqcloud.com",
};

describe("腾讯云 COS 存储", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("为允许的头像类型生成隔离的对象路径", () => {
    expect(avatarObjectKey("user-1", "image/png")).toMatch(
      /^avatars\/user-1\/[0-9a-f-]+\.png$/,
    );
    expect(avatarObjectKey("user-1", "image/svg+xml")).toBeNull();
  });

  it("使用签名 PUT 请求上传并返回公开地址", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "x-cos-request-id": "request-1" },
      }),
    );
    vi.stubGlobal("fetch", request);

    const url = await uploadCosObject({
      body: new ArrayBuffer(4),
      contentType: "image/webp",
      key: "avatars/user-1/avatar.webp",
      config,
    });

    expect(url).toBe(
      "https://project-1308913859.cos.ap-shanghai.myqcloud.com/avatars/user-1/avatar.webp",
    );
    expect(request).toHaveBeenCalledOnce();
    const [target, init] = request.mock.calls[0] as [URL, RequestInit];
    expect(target.toString()).toBe(url);
    expect(init).toMatchObject({
      method: "PUT",
      headers: expect.objectContaining({
        "Content-Type": "image/webp",
        Authorization: expect.stringMatching(
          /^q-sign-algorithm=sha1&q-ak=AKIDexample&/,
        ),
      }),
    });
  });
});
