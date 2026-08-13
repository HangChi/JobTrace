import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/modules/identity-access/infrastructure/better-auth.server";

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(auth);
