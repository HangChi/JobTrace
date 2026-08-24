import type { AdminAuditQuery } from "../application/admin-query-schema";

export function AdminAuditFilters({ query }: { query: AdminAuditQuery }) {
  return (
    <form className="panel admin-filters" action="/admin/audit" method="get">
      <label>
        <span>操作者</span>
        <input name="actor" maxLength={100} defaultValue={query.actor} />
      </label>
      <label>
        <span>目标用户</span>
        <input name="target" maxLength={100} defaultValue={query.target} />
      </label>
      <label>
        <span>操作类型</span>
        <select name="eventType" defaultValue={query.eventType}>
          <option value="all">全部操作</option>
          <option value="promote_admin">提升管理员</option>
          <option value="demote_admin">降级管理员</option>
          <option value="disable_user">禁用账号</option>
          <option value="enable_user">启用账号</option>
        </select>
      </label>
      <label>
        <span>结果</span>
        <select name="outcome" defaultValue={query.outcome}>
          <option value="all">全部结果</option>
          <option value="succeeded">成功</option>
          <option value="denied">已拒绝</option>
          <option value="conflict">冲突</option>
          <option value="failed">失败</option>
        </select>
      </label>
      <label>
        <span>开始日</span>
        <input
          type="date"
          name="occurredFrom"
          defaultValue={query.occurredFrom}
        />
      </label>
      <label>
        <span>结束日</span>
        <input type="date" name="occurredTo" defaultValue={query.occurredTo} />
      </label>
      <div className="actions admin-filter-actions">
        <button className="button" type="submit">
          应用筛选
        </button>
        <a className="button secondary" href="/admin/audit">
          清除筛选
        </a>
      </div>
    </form>
  );
}
