export type ProfileSectionIcon = "profile" | "security" | "data" | "account";

export const profileSections: Array<{
  id: string;
  label: string;
  icon: ProfileSectionIcon;
}> = [
  { id: "profile-details", label: "个人资料", icon: "profile" },
  { id: "profile-security", label: "账号安全", icon: "security" },
  { id: "profile-data", label: "数据管理", icon: "data" },
  { id: "profile-account", label: "账号信息", icon: "account" },
];

export function ProfileSectionIcon({ name }: { name: ProfileSectionIcon }) {
  const paths: Record<ProfileSectionIcon, React.ReactNode> = {
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

export function profileInitials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || "JT";
}

export function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
