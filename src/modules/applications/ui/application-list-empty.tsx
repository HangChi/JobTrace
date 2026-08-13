import Link from "next/link";

export function ApplicationListEmpty({
  filtered = false,
}: {
  filtered?: boolean;
}) {
  return (
    <section className="panel empty-state">
      <h2>{filtered ? "没有符合条件的记录" : "从第一份投递开始"}</h2>
      <p className="muted">
        {filtered
          ? "尝试清空或调整搜索条件。"
          : "记录公司、岗位与投递日期，后续进展就不会散落。"}
      </p>
      <Link className="button" href={filtered ? "/" : "/applications/new"}>
        {filtered ? "清空条件" : "新增投递"}
      </Link>
    </section>
  );
}
