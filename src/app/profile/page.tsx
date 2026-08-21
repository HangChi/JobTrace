import Link from "next/link";
import { getAnalyticsSummary } from "@/modules/analytics";
import { ExportButton } from "@/modules/data-transfer/ui/export-button";
import { getProfile } from "@/modules/identity-access";
import { PasswordForm } from "@/modules/identity-access/ui/password-form";
import { ProfileForm } from "@/modules/identity-access/ui/profile-form";
import { logoutAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

type IconName = "profile" | "security" | "data" | "account";

function SectionIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 20c.7-4.1 2.8-6 6.5-6s5.8 1.9 6.5 6" />
      </>
    ),
    security: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
      </>
    ),
    data: (
      <>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    account: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <circle cx="9" cy="11" r="2" />
        <path d="M6.5 16c.4-1.8 1.2-2.7 2.5-2.7s2.1.9 2.5 2.7M14 10h3M14 14h3" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || "JT";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

const sections: Array<{ id: string; label: string; icon: IconName }> = [
  { id: "profile-details", label: "个人资料", icon: "profile" },
  { id: "profile-security", label: "账号安全", icon: "security" },
  { id: "profile-data", label: "数据管理", icon: "data" },
  { id: "profile-account", label: "账号信息", icon: "account" },
];

export default async function ProfilePage() {
  const [profile, summary] = await Promise.all([
    getProfile(),
    getAnalyticsSummary(),
  ]);
  const roleLabel = profile.role === "admin" ? "管理员账号" : "个人账号";

  return (
    <section className="profile-page">
      <header className="profile-hero panel">
        <div className="profile-hero-identity">
          <span
            className={`profile-avatar profile-hero-avatar ${profile.image ? "has-image" : ""}`}
            style={
              profile.image
                ? { backgroundImage: `url(${profile.image})` }
                : undefined
            }
            role="img"
            aria-label={`${profile.displayName}头像`}
          >
            {!profile.image && initials(profile.displayName)}
          </span>
          <div>
            <p className="eyebrow">
              <span aria-hidden="true" /> 个人中心
            </p>
            <h1>{profile.displayName}</h1>
            <p className="profile-handle">@{profile.username}</p>
          </div>
        </div>
        <div className="profile-role-card">
          <span className="profile-status-dot" aria-hidden="true" />
          <span>
            <small>账号状态</small>
            <strong>{roleLabel} · 正常</strong>
          </span>
        </div>
      </header>

      <div className="profile-layout">
        <aside className="profile-index panel">
          <p>求职轨迹索引</p>
          <nav aria-label="个人中心分区">
            {sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                <span className="profile-index-marker" aria-hidden="true" />
                <SectionIcon name={section.icon} />
                {section.label}
              </a>
            ))}
          </nav>
          <p className="profile-index-note">资料、账号与投递数据都只属于你。</p>
        </aside>

        <div className="profile-content">
          <section
            className="profile-section panel"
            id="profile-details"
            aria-labelledby="profile-details-title"
          >
            <div className="profile-section-heading">
              <span className="profile-section-icon">
                <SectionIcon name="profile" />
              </span>
              <div>
                <p>让工作台更像你</p>
                <h2 id="profile-details-title">个人资料</h2>
              </div>
            </div>
            <ProfileForm
              profile={{
                displayName: profile.displayName,
                image: profile.image,
                username: profile.username,
              }}
            />
          </section>

          <section
            className="profile-section panel"
            id="profile-security"
            aria-labelledby="profile-security-title"
          >
            <div className="profile-section-heading">
              <span className="profile-section-icon security-icon">
                <SectionIcon name="security" />
              </span>
              <div>
                <p>保护每一条求职记录</p>
                <h2 id="profile-security-title">账号安全</h2>
              </div>
            </div>
            <PasswordForm />
          </section>

          <section
            className="profile-section panel"
            id="profile-data"
            aria-labelledby="profile-data-title"
          >
            <div className="profile-section-heading">
              <span className="profile-section-icon data-icon">
                <SectionIcon name="data" />
              </span>
              <div>
                <p>随时带走你的记录</p>
                <h2 id="profile-data-title">数据管理</h2>
              </div>
            </div>
            <div className="profile-data-overview">
              <div className="profile-data-count">
                <span>{summary.total.toLocaleString("zh-CN")}</span>
                <p>条投递记录由当前账号独立保存</p>
              </div>
              <div className="profile-data-actions">
                <Link className="button secondary" href="/import">
                  导入投递记录
                </Link>
                <ExportButton scope="all" disabled={summary.total === 0} />
              </div>
            </div>
            <p className="profile-data-note">
              {summary.total
                ? "导出文件包含全部投递记录，可选择 Excel 或 CSV 格式。"
                : "创建或导入第一条投递记录后，即可导出个人数据。"}
              面经暂不包含在导出文件中。
            </p>
          </section>

          <section
            className="profile-section panel profile-account-section"
            id="profile-account"
            aria-labelledby="profile-account-title"
          >
            <div className="profile-section-heading">
              <span className="profile-section-icon account-icon">
                <SectionIcon name="account" />
              </span>
              <div>
                <p>查看登录身份</p>
                <h2 id="profile-account-title">账号信息</h2>
              </div>
            </div>
            <dl className="profile-account-list">
              <div>
                <dt>用户名</dt>
                <dd>@{profile.username}</dd>
              </div>
              <div>
                <dt>账号类型</dt>
                <dd>{roleLabel}</dd>
              </div>
              <div>
                <dt>注册时间</dt>
                <dd>{formatDate(profile.createdAt)}</dd>
              </div>
            </dl>
            <div className="profile-signout">
              <div>
                <strong>退出当前账号</strong>
                <p>退出后，需要重新输入用户名和密码才能访问求职记录。</p>
              </div>
              <form action={logoutAction}>
                <button className="button secondary" type="submit">
                  退出登录
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
