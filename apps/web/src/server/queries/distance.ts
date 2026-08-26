import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { geodesicRouteEstimateKm, type Coordinates } from "@/lib/distance";
import { fetchRouteDistanceKm } from "@/lib/openrouteservice";
import { getGeodesicCorrectionFactor } from "@/lib/settings";

/** ~1m precision — collapses effectively-identical points onto the same cache key without
 * merging genuinely different addresses. */
function roundCoordinate(value: number): number {
  return Math.round(value * 100000) / 100000;
}

/**
 * Route distance in km between two geocoded points (SPEC.md §10, LOG-03): cached by coordinate
 * pair, else the real routing provider, else the geodesic estimate — never throws, so a freight
 * quote or coverage check never fails just because a distance couldn't be resolved.
 */
export async function resolveRouteDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number> {
  const originLat = roundCoordinate(origin.lat);
  const originLng = roundCoordinate(origin.lng);
  const destinationLat = roundCoordinate(destination.lat);
  const destinationLng = roundCoordinate(destination.lng);

  const cached = await db.query.routeDistanceCache.findFirst({
    where: and(
      eq(schema.routeDistanceCache.originLat, originLat),
      eq(schema.routeDistanceCache.originLng, originLng),
      eq(schema.routeDistanceCache.destinationLat, destinationLat),
      eq(schema.routeDistanceCache.destinationLng, destinationLng),
    ),
  });
  if (cached) return cached.distanceKm;

  const rounded = { lat: originLat, lng: originLng };
  const roundedDest = { lat: destinationLat, lng: destinationLng };

  const routeDistanceKm = await fetchRouteDistanceKm(rounded, roundedDest);
  const distanceKm = routeDistanceKm ?? geodesicRouteEstimateKm(rounded, roundedDest, await getGeodesicCorrectionFactor());
  const source = routeDistanceKm !== null ? "rota" : "geodesica";

  await db
    .insert(schema.routeDistanceCache)
    .values({ originLat, originLng, destinationLat, destinationLng, distanceKm, source })
    .onConflictDoNothing();

  return distanceKm;
}
