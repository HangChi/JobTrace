import type { AdminAuditEvent } from "../application/contracts";

const actionLabels: Record<AdminAuditEvent["eventType"], string> = {
  promote_admin: "提升为管理员",
  demote_admin: "降为普通用户",
  disable_user: "禁用账号",
  enable_user: "重新启用",
};
const outcomeLabels: Record<AdminAuditEvent["outcome"], string> = {
  succeeded: "成功",
  denied: "已拒绝",
  conflict: "冲突",
  failed: "失败",
};

export function AdminAuditTable({ events }: { events: AdminAuditEvent[] }) {
  if (!events.length)
    return (
      <section className="panel stack">
        <h2>没有匹配记录</h2>
        <p>调整条件或清除筛选。</p>
      </section>
    );
  return (
    <div className="panel table-wrap">
      <table className="admin-audit-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>操作者</th>
            <th>目标</th>
            <th>操作</th>
            <th>前后状态</th>
            <th>原因与结果</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td data-label="时间">
                {new Date(event.createdAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })}
              </td>
              <td data-label="操作者">
                {event.actorIdentifier}
                {event.actorDeleted ? "（账号已删除）" : ""}
              </td>
              <td data-label="目标">
                {event.targetIdentifier}
                {event.targetDeleted ? "（账号已删除）" : ""}
              </td>
              <td data-label="操作">{actionLabels[event.eventType]}</td>
              <td data-label="前后状态">
                {event.before.role}/{event.before.disabled ? "禁用" : "正常"} →{" "}
                {event.after
                  ? `${event.after.role}/${event.after.disabled ? "禁用" : "正常"}`
                  : "未变更"}
              </td>
              <td data-label="原因与结果">
                <strong>{outcomeLabels[event.outcome]}</strong>
                <span>{event.reason}</span>
                {event.failureCode ? <small>{event.failureCode}</small> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
