import { eq } from "drizzle-orm";
import { latestPositions } from "@/db/schema";
import { ensureDatabase, getDb } from "@/db";
import type { Position } from "@/lib/domain";
import { georefSearchUrl, parseGeorefResults, type GeocodeResult } from "@/lib/georef";
import { traccarAuthorization } from "@/lib/traccar-auth";
import { isDemoMode, setting } from "./settings";

function haversineMinutes(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const kilometers = 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  return Math.max(2, Math.round((kilometers / 28) * 60));
}

export async function routeTravelMinutes(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length < 2) return [0];
  const apiKey = setting("ORS_API_KEY");
  if (apiKey) {
    try {
      const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
        method: "POST",
        headers: { authorization: apiKey, "content-type": "application/json" },
        body: JSON.stringify({ coordinates: points.map((point) => [point.longitude, point.latitude]) }),
      });
      if (!response.ok) throw new Error(`ORS ${response.status}`);
      const payload = await response.json() as { features?: Array<{ properties?: { segments?: Array<{ duration: number }> } }> };
      const segments = payload.features?.[0]?.properties?.segments ?? [];
      if (segments.length === points.length - 1) return [0, ...segments.map((segment) => Math.max(1, Math.round(segment.duration / 60)))];
    } catch {
      // Conserva el servicio disponible con una estimación sin tráfico.
    }
  }
  return points.map((point, index) => index === 0 ? 0 : haversineMinutes(points[index - 1], point));
}

export async function geocode(query: string) {
  const apiKey = setting("ORS_API_KEY");
  if (apiKey) {
    try {
      const url = new URL("https://api.openrouteservice.org/geocode/search");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("text", query);
      url.searchParams.set("boundary.country", "AR");
      url.searchParams.set("size", "8");
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (response.ok) {
        const payload = await response.json() as { features?: Array<{ properties: { label?: string }; geometry: { coordinates: [number, number] } }> };
        const results: GeocodeResult[] = (payload.features ?? []).map((feature) => ({
          label: feature.properties.label ?? query,
          longitude: feature.geometry.coordinates[0],
          latitude: feature.geometry.coordinates[1],
        }));
        if (results.length) return results;
      }
    } catch {
      // Continúa con el servicio oficial argentino.
    }
  }

  try {
    const response = await fetch(georefSearchUrl(query), { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Georef ${response.status}`);
    return parseGeorefResults(await response.json());
  } catch {
    throw new Error("No se pudo consultar el buscador de direcciones. Probá nuevamente.");
  }
}

function demoPosition(): Position {
  const now = new Date().toISOString();
  return { latitude: -34.5746, longitude: -58.4877, accuracy: 12, deviceTime: now, fetchedAt: now };
}

function cachedPosition(row: typeof latestPositions.$inferSelect | undefined): Position | null {
  if (!row) return null;
  return { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy, deviceTime: row.deviceTime, fetchedAt: row.fetchedAt };
}

export async function latestTechnicianPosition(): Promise<Position | null> {
  await ensureDatabase();
  const db = getDb();
  const deviceId = setting("TRACCAR_DEVICE_ID") ?? "demo-device";
  const [cached] = await db.select().from(latestPositions).where(eq(latestPositions.deviceId, deviceId)).limit(1);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < 10_000) return cachedPosition(cached);

  const baseUrl = setting("TRACCAR_BASE_URL");
  const authorization = traccarAuthorization({
    token: setting("TRACCAR_API_TOKEN"),
    username: setting("TRACCAR_USERNAME"),
    password: setting("TRACCAR_PASSWORD"),
  });
  if (!baseUrl || !authorization || !setting("TRACCAR_DEVICE_ID")) {
    if (!isDemoMode()) return cachedPosition(cached);
    const position = demoPosition();
    await db.insert(latestPositions).values({ deviceId, ...position }).onConflictDoUpdate({ target: latestPositions.deviceId, set: position });
    return position;
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/positions`, {
      headers: { authorization, accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Traccar ${response.status}`);
    const rows = await response.json() as Array<{ deviceId: number | string; latitude: number; longitude: number; accuracy?: number; deviceTime: string }>;
    const match = rows.find((row) => String(row.deviceId) === String(setting("TRACCAR_DEVICE_ID")));
    if (!match) return cachedPosition(cached);
    const position: Position = {
      latitude: match.latitude,
      longitude: match.longitude,
      accuracy: typeof match.accuracy === "number" ? match.accuracy : null,
      deviceTime: match.deviceTime,
      fetchedAt: new Date().toISOString(),
    };
    await db.insert(latestPositions).values({ deviceId, ...position }).onConflictDoUpdate({ target: latestPositions.deviceId, set: position });
    return position;
  } catch {
    return cachedPosition(cached);
  }
}
