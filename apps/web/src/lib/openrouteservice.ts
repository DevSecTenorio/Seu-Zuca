import "server-only";

/**
 * OpenRouteService client (SPEC.md §10, LOG-03) — geocoding (structured Pelias search) and real
 * route distance (Directions API, driving-car profile). Free tier: openrouteservice.org, no
 * credit card. Both functions degrade to `null` (never throw) when unconfigured or the request
 * fails — callers fall back to the geodesic distance instead of failing the whole freight/coverage
 * calculation, per SPEC.md's explicit fallback requirement.
 */

export function isOpenRouteServiceConfigured(): boolean {
  return !!process.env.OPENROUTESERVICE_API_KEY;
}

export type Coordinates = { lat: number; lng: number };

export type GeocodeAddressInput = {
  cep: string;
  logradouro: string;
  numero: string;
  cidade: string;
  estado: string;
};

/**
 * Geocodes a Brazilian address via ORS's structured search. A generic interior-city CEP with no
 * real street/number naturally resolves to that city's centroid (SPEC.md §10) — that's just what
 * the geocoder returns when it can't find anything more specific, not a special case here.
 */
export async function geocodeAddress(input: GeocodeAddressInput): Promise<Coordinates | null> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    address: `${input.logradouro}, ${input.numero}`,
    locality: input.cidade,
    region: input.estado,
    country: "BRA",
    postalcode: input.cep,
    size: "1",
  });

  try {
    const response = await fetch(`https://api.openrouteservice.org/geocode/search/structured?${params}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (!coordinates) return null;
    return { lng: coordinates[0], lat: coordinates[1] };
  } catch {
    return null;
  }
}

/** Real route distance in km between two points via ORS's driving-car profile, or null if
 * unconfigured/unavailable — callers fall back to the geodesic distance. */
export async function fetchRouteDistanceKm(origin: Coordinates, destination: Coordinates): Promise<number | null> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { routes?: { summary?: { distance?: number } }[] };
    const distanceMeters = data.routes?.[0]?.summary?.distance;
    if (typeof distanceMeters !== "number") return null;
    return distanceMeters / 1000;
  } catch {
    return null;
  }
}
