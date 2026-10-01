import "server-only";

import { requireUser } from "../application/authorization";
import type { AccountRole } from "../application/contracts";
import { createServerDatabase } from "@/shared/database";
import { Problem } from "@/shared/errors/problem";

export type IdentityBridgeActor = {
  id: string;
  role: AccountRole;
  accessVersion: number;
};

/** Reads fresh authorization state only after Better Auth validates the session. */
export async function getIdentityBridgeActor(): Promise<IdentityBridgeActor> {
  const sessionActor = await requireUser();
  const sql = createServerDatabase();
  const [current] = await sql<
    Array<{ role: string; disabled: boolean; accessVersion: number }>
  >`select role, disabled, access_version from public.users where id=${sessionActor.id}`;

  if (!current || current.disabled) {
    throw new Problem("forbidden", "账号已被禁用。", 403);
  }
  if (
    !Number.isSafeInteger(current.accessVersion) ||
    current.accessVersion < 0
  ) {
    throw new Error("Invalid current account access version");
  }
  if (current.role !== "admin" && current.role !== "user") {
    throw new Error("Invalid current account role");
  }
  return {
    id: sessionActor.id,
    role: current.role,
    accessVersion: current.accessVersion,
  };
}
