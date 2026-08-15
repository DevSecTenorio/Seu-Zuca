import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, gt } from "drizzle-orm";
import * as schema from "@/db/schema";
import { hashToken } from "./crypto";

export const SESSION_COOKIE = "session_token";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type RoleStatus = {
  userId: string;
  role: (typeof schema.userRoleEnum.enumValues)[number];
  status: (typeof schema.userStatusEnum.enumValues)[number];
};

let edgeDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getEdgeDb() {
  if (!edgeDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    }
    edgeDb = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return edgeDb;
}

/**
 * Minimal, Edge-runtime-safe session lookup used by middleware. Deliberately uses the
 * stateless neon-http driver (a single fetch, no WebSocket handshake) instead of the pooled
 * client in src/db/index.ts — middleware runs on every request and only needs a fast
 * role/status read, never a transaction.
 */
export async function getRoleStatusForToken(token: string): Promise<RoleStatus | null> {
  const db = getEdgeDb();
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
