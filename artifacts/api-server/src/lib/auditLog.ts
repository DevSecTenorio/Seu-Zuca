import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export type AuditAction =
  | "user.approve"
  | "user.reject"
  | "user.suspend"
  | "user.create_internal"
  | "user.reset_password"
  | "commission.update_global"
  | "commission.update_user"
  | "commission.update_product"
  | "product.approve"
  | "product.reject"
  | "review.approve"
  | "review.reject"
  | "user.logout"
  | "auth.login_success"
  | "auth.login_failed"
  | "upload.request";

export interface AuditLogEntry {
  actorId?: number;
  actorEmail?: string;
  action: AuditAction;
  targetId?: number;
  targetType?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, actor_email, action, target_id, target_type, details, ip)
      VALUES (
        ${entry.actorId ?? null},
        ${entry.actorEmail ?? null},
        ${entry.action},
        ${entry.targetId ?? null},
        ${entry.targetType ?? null},
        ${entry.details ? JSON.stringify(entry.details) : null}::jsonb,
        ${entry.ip ?? null}
      )
    `);
  } catch (err) {
    logger.error({ err, entry }, "Failed to write audit log");
  }
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() ?? "unknown";
  }
  return req.socket.remoteAddress ?? "unknown";
}
