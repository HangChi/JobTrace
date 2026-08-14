type Summary = { users: number; disabledUsers: number; applications: number };

export function AdminSummary({ summary }: { summary: Summary }) {
  return (
    <section className="summary-grid" aria-label="全局摘要">
      <article className="panel">
        <strong>{summary.users}</strong>
        <span>用户</span>
      </article>
      <article className="panel">
        <strong>{summary.disabledUsers}</strong>
        <span>已禁用</span>
      </article>
      <article className="panel">
        <strong>{summary.applications}</strong>
        <span>全部投递</span>
      </article>
    </section>
  );
}
