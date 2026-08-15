import "server-only";
import { db, schema } from "@/db";

type LogAuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Every admin/moderation mutation records an audit_log row (CLAUDE.md). */
export async function logAudit(input: LogAuditInput): Promise<void> {
  await db.insert(schema.auditLogs).values({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}
