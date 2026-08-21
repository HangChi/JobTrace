export const accountRoles = ["user", "admin"] as const;
export type AccountRole = (typeof accountRoles)[number];

export type Actor = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  image: string | null;
  role: AccountRole;
  disabled: boolean;
};

export type Profile = Actor & {
  createdAt: string;
  updatedAt: string;
};
