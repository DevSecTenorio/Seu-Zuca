import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "./crypto";

export const SESSION_COOKIE = "session_token";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type RoleStatus = {
  userId: string;
  role: (typeof schema.userRoleEnum.enumValues)[number];
  status: (typeof schema.userStatusEnum.enumValues)[number];
};

/**
 * Minimal session lookup used by middleware (src/proxy.ts). Next.js 16's Proxy convention always
 * runs on the Node.js runtime (never Edge), so this can safely share the same pooled postgres-js
 * TCP client as the rest of the app — no separate edge-safe driver needed, unlike the old
 * Neon setup which used a stateless HTTP driver here specifically to work under Edge.
 */
export async function getRoleStatusForToken(token: string): Promise<RoleStatus | null> {
  const tokenHash = await hashToken(token);
  const rows = await db
    .select({
      userId: schema.users.id,
      role: schema.users.role,
      status: schema.users.status,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { userId: row.userId, role: row.role, status: row.status };
}
