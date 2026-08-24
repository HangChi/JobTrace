import Link from "next/link";
import type { AdminUserQuery } from "../application/admin-query-schema";

export function AdminUserFilters({ query }: { query: AdminUserQuery }) {
  return (
    <form className="panel admin-filters" action="/admin/users" method="get">
      <label>
        <span>用户名或内部邮箱</span>
        <input name="q" defaultValue={query.q} maxLength={100} />
      </label>
      <label>
        <span>角色</span>
        <select name="role" defaultValue={query.role}>
          <option value="all">全部角色</option>
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
      </label>
      <label>
        <span>状态</span>
        <select name="status" defaultValue={query.status}>
          <option value="all">全部状态</option>
          <option value="active">正常</option>
          <option value="disabled">已禁用</option>
        </select>
      </label>
      <label>
        <span>注册开始日</span>
        <input
          type="date"
          name="registeredFrom"
          defaultValue={query.registeredFrom}
        />
      </label>
      <label>
        <span>注册结束日</span>
        <input
          type="date"
          name="registeredTo"
          defaultValue={query.registeredTo}
        />
      </label>
      <div className="actions admin-filter-actions">
        <button className="button" type="submit">
          应用筛选
        </button>
        <Link className="button secondary" href="/admin/users">
          清除筛选
        </Link>
      </div>
    </form>
  );
}
