import Link from "next/link";
import type { Route } from "next";
import { NewApplicationDialog } from "./application-dialogs";
import type { ApplicationDetail } from "../application/contracts";

export function ApplicationListEmpty({
  filtered = false,
  onCreated,
}: {
  filtered?: boolean;
  onCreated?: (application: ApplicationDetail) => void;
}) {
  return (
    <section className="panel empty-state">
      <h2>{filtered ? "没有符合条件的记录" : "从第一份投递开始"}</h2>
      <p className="muted">
        {filtered
          ? "尝试清空或调整搜索条件。"
          : "记录公司、岗位与投递日期，后续进展就不会散落。"}
      </p>
      {filtered ? (
        <Link className="button" href={"/applications" as Route}>
          清空条件
        </Link>
      ) : (
        <NewApplicationDialog onSuccess={onCreated} />
      )}
    </section>
  );
}
