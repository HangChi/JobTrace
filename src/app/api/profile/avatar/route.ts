import { requireUser } from "@/modules/identity-access";
import { getCosEnv } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
import { problemResponse } from "@/shared/http/problem-response";
import {
  avatarObjectKey,
  hasImageSignature,
  uploadCosObject,
} from "@/shared/storage/tencent-cos.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!(file instanceof File)) {
      throw new Problem("validation", "请选择要上传的图片。", 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Problem("validation", "头像文件不能超过 5MB。", 400);
    }

    const body = await file.arrayBuffer();
    const key = avatarObjectKey(actor.id, file.type);
    if (!key) {
      throw new Problem(
        "validation",
        "头像仅支持 PNG、JPG、WEBP 或 GIF。",
        400,
      );
    }
    if (!hasImageSignature(body, file.type)) {
      throw new Problem(
        "validation",
        "文件内容与图片格式不匹配，请重新选择图片。",
        400,
      );
    }

    let config;
    try {
      config = getCosEnv();
    } catch {
      throw new Problem(
        "storage",
        "腾讯云 COS 配置不完整，请检查服务端环境变量。",
        500,
      );
    }

    let url: string;
    try {
      url = await uploadCosObject({
        body,
        contentType: file.type,
        key,
        config,
      });
    } catch {
      throw new Problem(
        "storage",
        "头像上传到腾讯云 COS 失败，请稍后重试。",
        502,
      );
    }
    return Response.json({ url });
  } catch (error) {
    return problemResponse(error);
  }
}
