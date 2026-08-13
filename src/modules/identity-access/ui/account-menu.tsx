import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import type { Actor } from "../application/contracts";
export function AccountMenu({ actor }: { actor: Actor }) {
  return (
    <nav className="account-menu" aria-label="账号导航">
      <span>
        {actor.email} · {actor.role === "admin" ? "管理员" : "普通用户"}
      </span>
      {actor.role === "admin" && <Link href="/admin">管理后台</Link>}
      <form action={logoutAction}>
        <button className="button secondary">退出</button>
      </form>
    </nav>
  );
}
