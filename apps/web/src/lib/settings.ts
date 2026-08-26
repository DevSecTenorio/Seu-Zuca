import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_COMMISSION_BASE, DEFAULT_COMMISSION_PERCENT, type CommissionBase } from "./commission";

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

/** SPEC.md §9 (decided 2026-08-25): whether commission is charged on merchandise alone or
 * merchandise + shipping — admin-configurable, same settings mechanism as commission_percent. */
export async function getCommissionBase(): Promise<CommissionBase> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "commission_base") });
  const value = row?.value;
  return value === "mercadoria" || value === "mercadoria_frete" ? value : DEFAULT_COMMISSION_BASE;
}

export async function setCommissionBase(value: CommissionBase): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key: "commission_base", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export const DEFAULT_GEODESIC_CORRECTION_FACTOR = 1.3;

/** SPEC.md §10, LOG-03: multiplies the straight-line distance when the routing provider is
 * unavailable, to approximate a real route distance. 1.3 is a reasonable default for Brazilian
 * road networks (real routes run ~20-40% longer than a straight line); admin-configurable since
 * the right factor varies by region. */
export async function getGeodesicCorrectionFactor(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "geodesic_correction_factor") });
  const value = row?.value;
  return typeof value === "number" ? value : DEFAULT_GEODESIC_CORRECTION_FACTOR;
}

export async function setGeodesicCorrectionFactor(value: number): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key: "geodesic_correction_factor", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}
