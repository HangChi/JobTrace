"use client";

import { Button } from "@/shared/ui/button";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="panel stack" role="alert">
      <h1>管理员数据暂时无法加载</h1>
      <p>未知数据不会显示为零。请稍后安全重试。</p>
      <Button type="button" onClick={reset}>
        重新加载
      </Button>
    </section>
  );
}
