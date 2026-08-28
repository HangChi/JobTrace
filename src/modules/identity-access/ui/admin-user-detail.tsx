import Link from "next/link";
import type { Route } from "next";
import type {
  AdminManagedApplication,
  AdminManagedInterview,
  ManagedUserDetail,
  PageResult,
} from "../application/contracts";
import { AdminAccessDialog } from "./admin-access-dialog";

const applicationStatus = {
  submitted: "已投递",
  offer: "Offer",
  refused: "已拒绝",
} as const;
const applicationType = {
  summer_internship: "暑期实习",
  daily_internship: "日常实习",
  early_campus_recruitment: "秋招提前批",
  campus_recruitment: "秋招",
  social_recruitment: "社招",
} as const;
const stageLabels: Record<string, string> = {
  screening: "简历筛选",
  assessment: "测评",
  written_test: "笔试",
  interview_1: "一面",
  interview_2: "二面",
  interview_3: "三面",
  hr_interview: "HR 面",
  final_interview: "终面",
};
const reviewStatus = {
  draft: "草稿",
  pending_review: "待复盘",
  completed: "已完成",
} as const;
const roundResult = {
  pending: "待反馈",
  passed: "通过",
  failed: "未通过",
} as const;
const formatLabel = { online: "线上", offline: "线下", phone: "电话" };

function pageHref(
  userId: string,
  returnTo: string,
  applicationsPage: number,
  interviewsPage: number,
) {
  const params = new URLSearchParams({
    returnTo,
    applicationsPage: String(applicationsPage),
    interviewsPage: String(interviewsPage),
  });
  return `/admin/users/${userId}?${params}` as Route;
}

function ContentPagination({
  label,
  page,
  href,
}: {
  label: string;
  page: PageResult<unknown>;
  href: (next: number) => Route;
}) {
  if (page.totalPages <= 1) return null;
  return (
    <nav className="admin-content-pagination" aria-label={`${label}分页`}>
      {page.page > 1 ? (
        <Link href={href(page.page - 1)}>← 上一页</Link>
      ) : (
        <span />
      )}
      <span>
        {page.page} / {page.totalPages}
      </span>
      {page.page < page.totalPages ? (
        <Link href={href(page.page + 1)}>下一页 →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function ApplicationRecord({ item }: { item: AdminManagedApplication }) {
  return (
    <article className="admin-content-record">
      <div className="admin-record-heading">
        <div>
          <span className="admin-record-date">{item.appliedDate}</span>
          <h3>{item.companyName}</h3>
          <p>
            {item.positionName}
            {item.city ? ` · ${item.city}` : ""}
          </p>
        </div>
        <div className="admin-record-tags">
          <span className={`admin-record-status is-${item.status}`}>
            {applicationStatus[item.status]}
          </span>
          <span>{applicationType[item.type]}</span>
        </div>
      </div>
      <details className="admin-record-disclosure">
        <summary>查看投递内容</summary>
        <div className="admin-record-body">
          <dl className="admin-inline-facts">
            <div>
              <dt>最近进展</dt>
              <dd>{item.latestDate}</dd>
            </div>
            <div>
              <dt>阶段数</dt>
              <dd>{item.stages.length}</dd>
            </div>
          </dl>
          {item.stages.length ? (
            <ol className="admin-stage-track">
              {item.stages.map((stage, index) => (
                <li key={`${stage.stage}-${stage.occurredOn}-${index}`}>
                  <span aria-hidden="true" />
                  <strong>{stageLabels[stage.stage] ?? stage.stage}</strong>
                  <time>{stage.occurredOn}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="admin-record-empty">尚未记录招聘阶段。</p>
          )}
          <section>
            <h4>投递备注</h4>
            <p className="admin-private-copy">{item.notes || "未填写备注。"}</p>
          </section>
          {item.jobUrl ? (
            <a href={item.jobUrl} target="_blank" rel="noreferrer">
              打开职位链接 ↗
            </a>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function InterviewRecord({ item }: { item: AdminManagedInterview }) {
  return (
    <article className="admin-content-record is-interview">
      <div className="admin-record-heading">
        <div>
          <span className="admin-record-date">{item.interviewedOn}</span>
          <h3>{item.companyName}</h3>
          <p>
            {item.positionName} · {stageLabels[item.stage] ?? item.stage}
          </p>
        </div>
        <div className="admin-record-tags">
          <span className={`admin-round-result is-${item.roundResult}`}>
            {roundResult[item.roundResult]}
          </span>
          <span>{reviewStatus[item.status]}</span>
        </div>
      </div>
      <details className="admin-record-disclosure">
        <summary>查看面经内容</summary>
        <div className="admin-record-body">
          <dl className="admin-inline-facts">
            <div>
              <dt>形式</dt>
              <dd>{item.format ? formatLabel[item.format] : "未记录"}</dd>
            </div>
            <div>
              <dt>时长</dt>
              <dd>
                {item.durationMinutes
                  ? `${item.durationMinutes} 分钟`
                  : "未记录"}
              </dd>
            </div>
            <div>
              <dt>问题</dt>
              <dd>{item.questions.length}</dd>
            </div>
          </dl>
          <div className="admin-interview-notes">
            {[
              ["面试官记录", item.interviewerNotes],
              ["表现亮点", item.highlights],
              ["待改进", item.gaps],
            ].map(([label, value]) => (
              <section key={label}>
                <h4>{label}</h4>
                <p className="admin-private-copy">{value || "未填写。"}</p>
              </section>
            ))}
          </div>
          {item.questions.length ? (
            <section>
              <h4>问题与复盘</h4>
              <ol className="admin-question-list">
                {item.questions.map((question, index) => (
                  <li key={`${question.question}-${index}`}>
                    <strong>{question.question}</strong>
                    {question.originalAnswer ? (
                      <p>原回答：{question.originalAnswer}</p>
                    ) : null}
                    {question.improvedAnswer ? (
                      <p>改进回答：{question.improvedAnswer}</p>
                    ) : null}
                    {question.followUpNotes ? (
                      <p>追问：{question.followUpNotes}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {item.actionItems.length ? (
            <section>
              <h4>行动项</h4>
              <ul className="admin-action-list">
                {item.actionItems.map((action, index) => (
                  <li key={`${action.content}-${index}`}>
                    <span aria-hidden="true">
                      {action.completed ? "✓" : "○"}
                    </span>
                    {action.content}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </details>
    </article>
  );
}

export function AdminUserDetail({
  user,
  actorId,
  returnTo,
}: {
  user: ManagedUserDetail;
  actorId: string;
  returnTo: string;
}) {
  const initials = user.username.slice(0, 2).toUpperCase();
  const applicationHref = (next: number) =>
    pageHref(user.id, returnTo, next, user.interviews.page);
  const interviewHref = (next: number) =>
    pageHref(user.id, returnTo, user.applications.page, next);
  return (
    <div className="admin-user-profile">
      <header className="admin-profile-hero">
        <div className="admin-profile-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="admin-profile-title">
          <p>账号档案 · 只读求职数据</p>
          <h1>{user.username}</h1>
          <span>{user.internalEmail}</span>
        </div>
        <div className="admin-profile-state">
          <span>{user.role === "admin" ? "管理员" : "普通用户"}</span>
          <span className={user.disabled ? "is-disabled" : "is-active"}>
            {user.disabled ? "已禁用" : "账号正常"}
          </span>
        </div>
      </header>

      <dl className="admin-profile-metrics">
        <div>
          <dt>投递记录</dt>
          <dd>{user.applicationCount}</dd>
        </div>
        <div>
          <dt>面经复盘</dt>
          <dd>{user.interviewCount}</dd>
        </div>
        <div>
          <dt>最近登录</dt>
          <dd>
            {user.lastSignInAt
              ? new Date(user.lastSignInAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })
              : "从未登录"}
          </dd>
        </div>
        <div>
          <dt>访问版本</dt>
          <dd>v{user.accessVersion}</dd>
        </div>
      </dl>

      <div className="admin-profile-layout">
        <main className="admin-user-content stack">
          <div className="admin-private-banner">
            <span aria-hidden="true">◈</span>
            <div>
              <strong>用户求职数据 · 管理员只读</strong>
              <p>
                本页可查看投递和面经正文；不提供编辑、删除或导出操作，查看行为会写入安全日志。
              </p>
            </div>
          </div>

          <section
            className="admin-content-section"
            aria-labelledby="admin-applications-title"
          >
            <div className="admin-content-heading">
              <div>
                <p>投递记录</p>
                <h2 id="admin-applications-title">投递记录</h2>
              </div>
              <strong>{user.applications.total}</strong>
            </div>
            <div className="admin-content-list">
              {user.applications.items.length ? (
                user.applications.items.map((item) => (
                  <ApplicationRecord item={item} key={item.id} />
                ))
              ) : (
                <p className="admin-content-empty">该用户还没有投递记录。</p>
              )}
            </div>
            <ContentPagination
              label="投递记录"
              page={user.applications}
              href={applicationHref}
            />
          </section>

          <section
            className="admin-content-section"
            aria-labelledby="admin-interviews-title"
          >
            <div className="admin-content-heading">
              <div>
                <p>面试复盘</p>
                <h2 id="admin-interviews-title">面经复盘</h2>
              </div>
              <strong>{user.interviews.total}</strong>
            </div>
            <div className="admin-content-list">
              {user.interviews.items.length ? (
                user.interviews.items.map((item) => (
                  <InterviewRecord item={item} key={item.id} />
                ))
              ) : (
                <p className="admin-content-empty">该用户还没有面经记录。</p>
              )}
            </div>
            <ContentPagination
              label="面经复盘"
              page={user.interviews}
              href={interviewHref}
            />
          </section>
        </main>

        <aside className="admin-profile-sidebar">
          <section className="admin-side-panel">
            <p className="admin-side-kicker">访问控制</p>
            <h2>访问控制</h2>
            <dl className="admin-account-facts">
              <div>
                <dt>注册时间</dt>
                <dd>
                  {new Date(user.createdAt).toLocaleDateString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                  })}
                </dd>
              </div>
              <div>
                <dt>当前角色</dt>
                <dd>{user.role === "admin" ? "管理员" : "普通用户"}</dd>
              </div>
            </dl>
            <AdminAccessDialog user={user} actorId={actorId} />
          </section>

          <section className="admin-side-panel">
            <div className="admin-side-heading">
              <div>
                <p className="admin-side-kicker">审计记录</p>
                <h2>最近变更</h2>
              </div>
              <Link href={`/admin/audit?target=${encodeURIComponent(user.id)}`}>
                全部
              </Link>
            </div>
            {user.recentAuditEvents.length ? (
              <ol className="admin-audit-timeline">
                {user.recentAuditEvents.map((event) => (
                  <li key={event.id}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{event.eventType}</strong>
                      <small>{event.outcome}</small>
                      <time>
                        {new Date(event.createdAt).toLocaleString("zh-CN", {
                          timeZone: "Asia/Shanghai",
                        })}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="admin-side-empty">暂无管理变更。</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
