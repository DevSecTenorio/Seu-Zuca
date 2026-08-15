import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Company, User } from "@/db/schema";
import { generateToken, hashToken } from "./crypto";
import { SESSION_COOKIE, SESSION_DURATION_MS } from "./session-core";

export { SESSION_COOKIE };

export type AuthenticatedUser = User & { company: Company | null };

export async function createSession(userId: string) {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(schema.sessions).values({ userId, tokenHash, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/** Cached per-request: safe to call from multiple server components without extra DB hits. */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, new Date())),
    with: {
      user: {
        with: { company: true },
      },
    },
  });

  return session?.user ?? null;
});

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = await hashToken(token);
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function destroyAllSessionsForUser(userId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
