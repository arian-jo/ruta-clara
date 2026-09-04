"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicStatus } from "@/lib/domain";
import LiveMap from "./LiveMap";

const punctualityLabels = { ahead: "Viene adelantado", on_time: "En horario", delayed: "Con demora", unknown: "Calculando" };

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(`${value}T12:00:00-03:00`));
}

export default function CustomerTracking() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
    queueMicrotask(() => setToken(value));
  }, []);

  const load = useCallback(async () => {
    if (!token) { setError("Este enlace está incompleto."); setLoading(false); return; }
    try {
      const response = await fetch("/api/public/status", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json() as PublicStatus & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No pudimos abrir este seguimiento.");
      setStatus(payload); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos actualizar el seguimiento."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  if (loading) return <main className="customer-shell customer-loading"><div className="loading-mark">R</div><p>Buscando tu visita…</p></main>;
  if (error || !status) return <main className="customer-shell"><header className="customer-header"><span className="brand"><span className="brand-mark">R</span>Ruta Clara</span></header><section className="link-error"><p className="eyebrow">Seguimiento no disponible</p><h1>Este enlace ya no está activo.</h1><p>{error || "Pedile al técnico un enlace nuevo."}</p></section></main>;

  const ageMinutes = status.tracking.position ? Math.max(0, Math.floor((Date.parse(status.tracking.position.fetchedAt) - Date.parse(status.tracking.position.deviceTime)) / 60_000)) : null;
  return <main className="customer-shell">
    <header className="customer-header"><span className="brand"><span className="brand-mark">R</span>Ruta Clara</span><span className="secure-label">Enlace privado</span></header>
    <section className="customer-hero">
      <p className="eyebrow">Tu visita · {formatDate(status.serviceDate)}</p>
      <h1>{status.message}</h1>
      <div className="eta-row"><div><span>Llegada estimada</span><strong>{formatTime(status.eta.at)}</strong></div><span className={`punctuality punctuality-${status.punctuality}`}>{punctualityLabels[status.punctuality]}</span></div>
    </section>
    <section className="tracking-grid">
      <div className="customer-map-card">
        {status.tracking.visible && status.tracking.position ? <LiveMap position={status.tracking.position} compact /> : <div className="map-unavailable"><span className="paused-icon">◎</span><h2>Ubicación no disponible</h2><p>{trackingReason(status.tracking.reason)}</p></div>}
        {status.tracking.visible && <div className="map-live-badge"><span className="live-dot" />Ubicación en vivo</div>}
      </div>
      <aside className="visit-summary">
        <p className="eyebrow">Resumen</p>
        <dl><div><dt>Franja acordada</dt><dd>{formatTime(status.window.start)}–{formatTime(status.window.end)}</dd></div><div><dt>Visitas anteriores</dt><dd>{status.stopsAhead}</dd></div><div><dt>Última actualización</dt><dd>{status.eta.updatedAt ? formatTime(status.eta.updatedAt) : "Pendiente"}</dd></div>{status.tracking.position?.accuracy && <div><dt>Precisión GPS</dt><dd>±{Math.round(status.tracking.position.accuracy)} m</dd></div>}</dl>
        {ageMinutes !== null && ageMinutes >= 2 && <p className="stale-note">La posición tiene {ageMinutes} min de antigüedad.</p>}
        <p className="privacy-copy">La ubicación desaparece al completar tu visita, pausar el recorrido o cerrar el día.</p>
      </aside>
    </section>
  </main>;
}

function trackingReason(reason: PublicStatus["tracking"]["reason"]) {
  if (reason === "paused") return "El técnico pausó temporalmente el seguimiento.";
  if (reason === "finished") return "La visita terminó y la ubicación dejó de compartirse.";
  if (reason === "revoked" || reason === "expired") return "Este seguimiento ya finalizó.";
  if (reason === "stale") return "No recibimos una posición reciente y ocultamos el marcador por seguridad.";
  return "El técnico todavía no inició el recorrido.";
}
