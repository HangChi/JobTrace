import Link from "next/link";
import type { ManagedUserSummary } from "../application/contracts";

const date = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateTime = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function initials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export function UserAdminTable({
  users,
  returnTo = "/admin/users",
}: {
  users: ManagedUserSummary[];
  returnTo?: string;
}) {
  if (!users.length) {
    return (
      <section className="admin-empty-state">
        <span aria-hidden="true">⌕</span>
        <div>
          <h2>没有匹配用户</h2>
          <p>调整筛选条件，或返回完整账号目录。</p>
        </div>
        <Link className="button secondary" href="/admin/users">
          清除筛选
        </Link>
      </section>
    );
  }
  return (
    <div className="admin-directory-table-wrap">
      <table className="admin-user-table">
        <colgroup>
          <col className="admin-user-col-identity" />
          <col className="admin-user-col-access" />
          <col className="admin-user-col-activity" />
          <col className="admin-user-col-records" />
          <col className="admin-user-col-action" />
        </colgroup>
        <thead>
          <tr>
            <th>账号</th>
            <th>访问状态</th>
            <th>近期活动</th>
            <th>求职记录</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="账号">
                <div className="admin-user-identity">
                  <span className="admin-user-avatar" aria-hidden="true">
                    {initials(user.username)}
                  </span>
                  <span>
                    <strong>{user.username}</strong>
                    <small>{user.internalEmail}</small>
                  </span>
                </div>
              </td>
              <td data-label="访问状态">
                <div className="admin-access-badges">
                  <span className="admin-role-badge">
                    {user.role === "admin" ? "管理员" : "普通用户"}
                  </span>
                  <span
                    className={`admin-state-badge ${user.disabled ? "is-disabled" : "is-active"}`}
                  >
                    {user.disabled ? "已禁用" : "正常"}
                  </span>
                </div>
              </td>
              <td data-label="近期活动">
                <dl className="admin-activity-pair">
                  <div>
                    <dt>注册</dt>
                    <dd>{date.format(new Date(user.createdAt))}</dd>
                  </div>
                  <div>
                    <dt>登录</dt>
                    <dd>
                      {user.lastSignInAt
                        ? dateTime.format(new Date(user.lastSignInAt))
                        : "从未登录"}
                    </dd>
                  </div>
                </dl>
              </td>
              <td data-label="求职记录">
                <div className="admin-record-counts">
                  <span>
                    <strong>{user.applicationCount}</strong> 投递
                  </span>
                  <span>
                    <strong>{user.interviewCount}</strong> 面经
                  </span>
                </div>
              </td>
              <td data-label="操作">
                <Link
                  className="admin-open-profile"
                  aria-label="查看详情"
                  href={`/admin/users/${user.id}?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  打开档案 <span aria-hidden="true">↗</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
