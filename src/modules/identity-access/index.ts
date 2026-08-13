export type { AccountRole, Actor, Profile } from "./application/contracts";
export {
  getActor,
  requireUser,
  requireAdmin,
  requirePageUser,
  requirePageAdmin,
} from "./application/authorization";
export {
  registerSchema,
  loginSchema,
  safeReturnTo,
} from "./application/auth-schema";
export {
  register,
  login,
  logout,
  requestPasswordReset,
  updatePassword,
} from "./application/auth-service";
export { listUsers, updateUserAccess } from "./application/admin-user-service";
export { getAdminSummary } from "./application/admin-summary-service";
export { hasAuthConfiguration } from "@/shared/config/env";
