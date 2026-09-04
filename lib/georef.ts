export type GeocodeResult = { label: string; latitude: number; longitude: number };

type GeorefPayload = {
  direcciones?: Array<{
    nomenclatura?: string;
    ubicacion?: { lat?: number; lon?: number };
  }>;
};

export function georefSearchUrl(query: string) {
  const url = new URL("https://apis.datos.gob.ar/georef/api/direcciones");
  url.searchParams.set("direccion", query);
  url.searchParams.set("max", "8");
  return url;
}

export function parseGeorefResults(payload: GeorefPayload): GeocodeResult[] {
  return (payload.direcciones ?? []).flatMap((result) => {
    const latitude = result.ubicacion?.lat;
    const longitude = result.ubicacion?.lon;
    if (!result.nomenclatura || typeof latitude !== "number" || typeof longitude !== "number") return [];
    return [{ label: result.nomenclatura, latitude, longitude }];
  });
}
