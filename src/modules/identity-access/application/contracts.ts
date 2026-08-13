export const accountRoles = ["user", "admin"] as const;
export type AccountRole = (typeof accountRoles)[number];

export type Actor = {
  id: string;
  email: string;
  role: AccountRole;
  disabled: boolean;
};

export type Profile = Actor & {
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};
