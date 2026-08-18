import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { logoutAction } from "@/app/(auth)/actions";
import { DismissibleDetails } from "@/shared/ui/dismissible-details";
import type { Actor } from "../application/contracts";

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function AccountMenu({ actor }: { actor: Actor }) {
  return (
    <nav className="app-header" aria-label="账号导航">
      <Link className="app-brand" href="/" aria-label="JobTrace 首页">
        <Image
          className="app-brand-mark"
          src="/icon.svg"
          alt=""
          width={38}
          height={38}
        />
        <span>
          <strong>JobTrace</strong>
          <small>求职进度工作台</small>
        </span>
      </Link>
      <div className="app-primary-nav" aria-label="主要功能">
        <Link href="/">投递记录</Link>
        <Link href={"/interviews" as Route}>面经</Link>
      </div>
      <DismissibleDetails className="account-menu">
        <summary aria-label="打开用户菜单">
          <span className="user-avatar" aria-hidden="true">
            {initials(actor.email)}
          </span>
          <span className="user-summary">
            <strong>{actor.email.split("@")[0]}</strong>
            <small>{actor.role === "admin" ? "管理员" : "普通用户"}</small>
          </span>
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
          </svg>
        </summary>
        <div className="account-popover">
          <div className="account-identity">
            <span className="user-avatar" aria-hidden="true">
              {initials(actor.email)}
            </span>
            <span>
              <strong>{actor.email}</strong>
              <small>
                {actor.role === "admin" ? "管理员账号" : "个人账号"}
              </small>
            </span>
          </div>
          <Link href="/import">导入投递记录</Link>
          {actor.role === "admin" && <Link href="/admin">管理后台</Link>}
          <form action={logoutAction}>
            <button type="submit">退出登录</button>
          </form>
        </div>
      </DismissibleDetails>
    </nav>
  );
}
