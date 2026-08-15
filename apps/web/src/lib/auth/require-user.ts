import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthenticatedUser } from "./session";
import type { schema } from "@/db";

type Role = (typeof schema.userRoleEnum.enumValues)[number];

/**
 * Defense-in-depth check for server actions and pages: middleware already gates routes,
 * but every mutation must re-verify the actor on the server (CLAUDE.md: authorization is
 * never trusted from the client).
 */
export async function requireUser(allowedRoles?: Role[]): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.status === "suspenso" || user.status === "rejeitado") {
    redirect("/conta-bloqueada");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect("/");
  }
  return user;
}

export async function requireApprovedUser(allowedRoles?: Role[]): Promise<AuthenticatedUser> {
  const user = await requireUser(allowedRoles);
  if (user.status === "pendente") {
    redirect("/aguardando-aprovacao");
  }
  return user;
}
