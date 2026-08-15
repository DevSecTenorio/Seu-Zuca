import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_COMMISSION_PERCENT } from "./commission";

export async function getCommissionPercent(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "commission_percent") });
  const value = row?.value;
  return typeof value === "number" ? value : DEFAULT_COMMISSION_PERCENT;
}

export async function setCommissionPercent(value: number): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key: "commission_percent", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}
