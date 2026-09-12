"use client";

import { useEffect, useState } from "react";

// 邮箱验证码发送的共享骨架：60 秒冷却倒计时 + 发送态。
// 消息文案由调用方通过回调接管（注册表单和邮箱换绑表单的
// 消息区与各自其他操作共用）。
export function useVerificationCodeSender(
  send: () => Promise<string>,
  handlers: {
    onSuccess?: (message: string) => void;
    onError?: (message: string) => void;
  } = {},
  seconds = 60,
) {
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function run() {
    if (sending || cooldown > 0) return;
    setSending(true);
    try {
      const message = await send();
      setCooldown(seconds);
      handlers.onSuccess?.(message);
    } catch (reason) {
      handlers.onError?.(
        reason instanceof Error ? reason.message : "验证码发送失败。",
      );
    } finally {
      setSending(false);
    }
  }

  return { cooldown, sending, run };
}
