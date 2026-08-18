import { requirePageUser } from "@/modules/identity-access";
import { ProfileForm } from "@/modules/identity-access/ui/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const actor = await requirePageUser();
  return (
    <section className="stack page-gap profile-page">
      <div className="hero-row dashboard-hero profile-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span aria-hidden="true" /> 个人中心
          </p>
          <h1>整理你的个人资料</h1>
          <p className="lead">更新昵称和头像，让每一次复盘都更像你的工作台。</p>
        </div>
      </div>
      <ProfileForm actor={actor} />
    </section>
  );
}
