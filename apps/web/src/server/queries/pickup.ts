import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function getSupplierPickupLocations(supplierId: string) {
  return db.query.pickupLocations.findMany({
    where: eq(schema.pickupLocations.supplierId, supplierId),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
}

/** Active pickup locations only — what checkout offers the buyer to choose from (SPEC.md §10,
 * LOG-05). A supplier with none simply doesn't offer "retirada" as a modality. */
export async function getActiveSupplierPickupLocations(supplierId: string) {
  return db.query.pickupLocations.findMany({
    where: and(eq(schema.pickupLocations.supplierId, supplierId), eq(schema.pickupLocations.active, true)),
    orderBy: (p, { asc }) => [asc(p.label)],
  });
}
