import "../../styles/profile.css";
import Link from "next/link";
import { getAnalyticsSummary } from "@/modules/analytics";
import { ExportButton } from "@/modules/data-transfer/ui/export-button";
import { getProfile, listAccountSessions } from "@/modules/identity-access";
import { CredentialSettings } from "@/modules/identity-access/ui/credential-settings";
import { ProfileForm } from "@/modules/identity-access/ui/profile-form";
import { SessionList } from "@/modules/identity-access/ui/session-list";
import { logoutAction } from "@/app/(auth)/actions";
import {
  formatProfileDate,
  profileInitials,
  profileSections,
  ProfileSectionIcon,
} from "./profile-page-ui";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profile, summary, sessions] = await Promise.all([
    getProfile(),
    getAnalyticsSummary(),
    listAccountSessions(),
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
            {!profile.image && profileInitials(profile.displayName)}
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
            {profileSections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                <span className="profile-index-marker" aria-hidden="true" />
                <ProfileSectionIcon name={section.icon} />
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
                <ProfileSectionIcon name="profile" />
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
                <ProfileSectionIcon name="security" />
              </span>
              <div>
                <p>保护每一条求职记录</p>
                <h2 id="profile-security-title">账号安全</h2>
              </div>
            </div>
            <CredentialSettings email={profile.recoveryEmail} />
            <div className="profile-security-sessions">
              <h3>登录设备</h3>
              <p>撤销不认识或不再使用的登录会话。</p>
              <SessionList initial={sessions} />
            </div>
          </section>

          <section
            className="profile-section panel"
            id="profile-data"
            aria-labelledby="profile-data-title"
          >
            <div className="profile-section-heading">
              <span className="profile-section-icon data-icon">
                <ProfileSectionIcon name="data" />
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
                <ProfileSectionIcon name="account" />
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
                <dd>{formatProfileDate(profile.createdAt)}</dd>
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
