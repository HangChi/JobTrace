import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAuthConfiguration } from "@/shared/config/env";
import { Problem } from "@/shared/errors/problem";
import type { Actor } from "./contracts";
import { auth } from "../infrastructure/better-auth.server";

export async function getActor(): Promise<Actor | null> {
  if (!hasAuthConfiguration()) return null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = session.user as typeof session.user & {
    role?: string;
    banned?: boolean | null;
  };
  return {
    id: user.id,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
    disabled: Boolean(user.banned),
  };
}

export async function requireUser(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new Problem("unauthorized", "请先登录。", 401);
  if (actor.disabled) throw new Problem("forbidden", "账号已被禁用。", 403);
  return actor;
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireUser();
  if (actor.role !== "admin")
    throw new Problem("forbidden", "需要管理员权限。", 403);
  return actor;
}

export async function requirePageUser() {
  const actor = await getActor();
  if (!actor || actor.disabled) redirect("/login");
  return actor;
}

export async function requirePageAdmin() {
  const actor = await requirePageUser();
  if (actor.role !== "admin") redirect("/");
  return actor;
}
