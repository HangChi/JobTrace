"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h1>页面暂时无法加载</h1>
      <p>请稍后重试，若问题持续出现请检查服务状态。</p>
      <button className="button" onClick={reset}>
        重试
      </button>
    </section>
  );
}
