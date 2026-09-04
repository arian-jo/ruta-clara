"use client";

import { useEffect, useRef } from "react";
import type { Position } from "@/lib/domain";
import type { StyleSpecification } from "maplibre-gl";

type Marker = { id: string; latitude: number; longitude: number; label: string; active?: boolean };
type MapLibreModule = typeof import("maplibre-gl");

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: { openStreetMap: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
  layers: [{ id: "openStreetMap", type: "raster", source: "openStreetMap" }],
};

function addRouteMarkers(maplibregl: MapLibreModule, map: import("maplibre-gl").Map, markers: Marker[]) {
  return markers.map((marker, index) => {
    const element = document.createElement("div");
    element.className = `route-marker${marker.active ? " is-active" : ""}`;
    element.textContent = "📍";
    element.dataset.order = String(index + 1);
    element.title = marker.label;
    return new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([marker.longitude, marker.latitude]).addTo(map);
  });
}

function addTechnicianMarker(maplibregl: MapLibreModule, map: import("maplibre-gl").Map, position: Position) {
  const element = document.createElement("div");
  element.className = "technician-marker";
  element.textContent = "🚗";
  element.title = "Ubicación del vehículo";
  return new maplibregl.Marker({ element }).setLngLat([position.longitude, position.latitude]).addTo(map);
}

export default function LiveMap({ markers = [], position, compact = false, selectionMode = false, onPointSelect }: { markers?: Marker[]; position?: Position | null; compact?: boolean; selectionMode?: boolean; onPointSelect?: (point: { latitude: number; longitude: number }) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const pointSelectRef = useRef(onPointSelect);
  const markersRef = useRef(markers);
  const positionRef = useRef(position);
  const mapRef = useRef<import("maplibre-gl").Map>();
  const moduleRef = useRef<MapLibreModule>();
  const routeMarkersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const technicianMarkerRef = useRef<import("maplibre-gl").Marker>();
  const selectionMarkerRef = useRef<import("maplibre-gl").Marker>();
  const markerSignature = markers.map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}:${marker.label}:${Boolean(marker.active)}`).join("|");
  const positionSignature = position ? `${position.latitude}:${position.longitude}` : "";

  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { pointSelectRef.current = onPointSelect; }, [onPointSelect]);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;

    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !container.current) return;
      const currentMarkers = markersRef.current;
      const currentPosition = positionRef.current;
      const points = currentPosition ? [{ longitude: currentPosition.longitude, latitude: currentPosition.latitude }, ...currentMarkers] : currentMarkers;
      const center: [number, number] = points.length ? [points[0].longitude, points[0].latitude] : [-58.45, -34.58];
      const map = new maplibregl.Map({ container: container.current, style: MAP_STYLE, center, zoom: points.length > 1 ? 10.5 : 13, attributionControl: false });
      mapRef.current = map;
      moduleRef.current = maplibregl;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

      if (selectionMode) {
        map.getCanvas().style.cursor = "crosshair";
        map.on("click", (event) => {
          if (!selectionMarkerRef.current) {
            const element = document.createElement("div");
            element.className = "selection-pin";
            element.textContent = "📍";
            element.setAttribute("aria-label", "Punto seleccionado");
            selectionMarkerRef.current = new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat(event.lngLat).addTo(map);
          } else selectionMarkerRef.current.setLngLat(event.lngLat);
          pointSelectRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        });
      }

      routeMarkersRef.current = addRouteMarkers(maplibregl, map, currentMarkers);
      if (currentPosition) technicianMarkerRef.current = addTechnicianMarker(maplibregl, map, currentPosition);
      if (points.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
        map.fitBounds(bounds, { padding: compact ? 44 : 72, maxZoom: 14, duration: 0 });
      }
    });

    return () => {
      cancelled = true;
      routeMarkersRef.current.forEach((marker) => marker.remove());
      routeMarkersRef.current = [];
      technicianMarkerRef.current?.remove();
      technicianMarkerRef.current = undefined;
      selectionMarkerRef.current?.remove();
      selectionMarkerRef.current = undefined;
      mapRef.current?.remove();
      mapRef.current = undefined;
      moduleRef.current = undefined;
    };
  }, [compact, selectionMode]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = moduleRef.current;
    if (!map || !maplibregl) return;
    routeMarkersRef.current.forEach((marker) => marker.remove());
    routeMarkersRef.current = addRouteMarkers(maplibregl, map, markersRef.current);
    selectionMarkerRef.current?.remove();
    selectionMarkerRef.current = undefined;
  }, [markerSignature]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = moduleRef.current;
    if (!map || !maplibregl) return;
    if (!positionRef.current) {
      technicianMarkerRef.current?.remove();
      technicianMarkerRef.current = undefined;
    } else if (technicianMarkerRef.current) {
      technicianMarkerRef.current.setLngLat([positionRef.current.longitude, positionRef.current.latitude]);
    } else technicianMarkerRef.current = addTechnicianMarker(maplibregl, map, positionRef.current);
  }, [positionSignature]);

  return <div className={`live-map${compact ? " compact" : ""}${selectionMode ? " is-selecting" : ""}`} ref={container} aria-label={selectionMode ? "Mapa para elegir el punto de la visita" : "Mapa de seguimiento"} />;
}
