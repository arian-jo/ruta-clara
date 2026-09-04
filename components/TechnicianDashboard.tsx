"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanView, Position, StopView } from "@/lib/domain";
import LiveMap from "./LiveMap";

const statusLabels = {
  draft: "Borrador", active: "Compartiendo", paused: "En pausa", closed: "Cerrado", expired: "Vencido",
  planned: "Pendiente", en_route: "En camino", in_service: "En servicio", completed: "Completado", skipped: "Omitido", cancelled: "Cancelado",
} as const;

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value));
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

type ApiState = { loading: boolean; error: string | null; plans: PlanView[]; position: Position | null };

export default function TechnicianDashboard() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<ApiState>({ loading: true, error: null, plans: [], position: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewPlanId, setViewPlanId] = useState("");

  useEffect(() => {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const fragmentToken = fragment.get("token");
    const value = fragmentToken ?? sessionStorage.getItem("ruta-clara-technician-token") ?? "";
    if (value) sessionStorage.setItem("ruta-clara-technician-token", value);
    if (fragmentToken) history.replaceState(null, "", `${location.pathname}${location.search}`);
    queueMicrotask(() => {
      setToken(value);
      if (!value) setState((current) => ({ ...current, loading: false, error: "Falta el enlace privado del técnico." }));
    });
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch("/api/technician/plans", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json() as { plans?: PlanView[]; position?: Position | null; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar la agenda.");
      setState({ loading: false, error: null, plans: payload.plans ?? [], position: payload.position ?? null });
    } catch (error) {
      setState((current) => ({ loading: false, error: error instanceof Error ? error.message : "Error inesperado", plans: current.plans, position: current.position }));
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 15_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [load]);

  const plan = useMemo(() => state.plans.find((item) => item.id === viewPlanId) ?? state.plans.find((item) => item.serviceDate === today()) ?? state.plans[0], [state.plans, viewPlanId]);
  const current = plan?.stops.find((stop) => stop.status === "en_route" || stop.status === "in_service");

  async function planAction(action: string) {
    if (!plan) return;
    await mutate(`/api/technician/plans/${plan.id}/${action}`);
  }

  async function stopAction(stop: StopView, action: string, body?: unknown) {
    await mutate(`/api/technician/stops/${stop.id}/${action}`, body);
  }

  async function mutate(url: string, body?: unknown, method = "POST") {
    setNotice("Guardando…");
    const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setNotice(payload.error ?? "No se pudo guardar."); return; }
    setNotice("Actualizado");
    await load();
    window.setTimeout(() => setNotice(""), 1800);
  }

  async function move(stop: StopView, direction: -1 | 1) {
    if (!plan) return;
    const ids = plan.stops.map((item) => item.id);
    const from = ids.indexOf(stop.id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await mutate(`/api/technician/plans/${plan.id}/reorder`, { orderedIds: ids }, "PATCH");
  }

  async function copyLink(stop: StopView) {
    if (!stop.publicUrl) return;
    await navigator.clipboard.writeText(stop.publicUrl);
    setNotice("Enlace copiado");
    window.setTimeout(() => setNotice(""), 1800);
  }

  if (state.loading && !plan) return <main className="loading-screen"><div className="loading-mark">R</div><p>Preparando la agenda…</p></main>;
  if (!token) return <main className="customer-shell"><header className="customer-header"><span className="brand"><span className="brand-mark">R</span>Ruta Clara</span></header><section className="link-error"><p className="eyebrow">Acceso privado</p><h1>Este panel necesita un enlace válido.</h1><p>Usá el enlace técnico original o volvé a abrirlo desde donde lo guardaste.</p></section></main>;

  return (
    <main className="dashboard-shell">
      <header className="topbar dashboard-topbar">
        <a className="brand" href="#inicio"><span className="brand-mark">R</span><span>Ruta Clara</span></a>
        <div className="topbar-actions"><button className="topbar-create" onClick={() => setCreating(true)}>+ Nueva agenda</button><div className={`sharing-pill sharing-${plan?.status ?? "draft"}`}><span className="live-dot" />{plan ? statusLabels[plan.status] : "Sin agenda"}</div></div>
      </header>

      <section className="dashboard-hero" id="inicio">
        <div className="hero-copy">
          <div className="agenda-switch"><p className="eyebrow">{plan?.serviceDate === today() ? "Agenda de hoy" : "Agenda programada"} · {plan?.stops.length ?? 0} visitas</p>{state.plans.length > 1 && <select aria-label="Elegir agenda" value={plan?.id ?? ""} onChange={(event) => setViewPlanId(event.target.value)}>{state.plans.map((item) => <option value={item.id} key={item.id}>{item.serviceDate} · {item.stops.length} visitas</option>)}</select>}</div>
          <h1>Este es<br />tu recorrido.</h1>
          <p className="lede">Desde acá organizás las visitas, compartís el seguimiento con cada cliente y decidís cuándo mostrar tu ubicación.</p>
          <div className="hero-actions">
            {plan?.status === "draft" && <button className="primary-button" onClick={() => planAction("start")}>Iniciar recorrido</button>}
            {plan?.status === "active" && <button className="primary-button" onClick={() => planAction("pause")}>Pausar ubicación</button>}
            {plan?.status === "paused" && <button className="primary-button" onClick={() => planAction("resume")}>Reanudar recorrido</button>}
            {plan && !["closed", "expired"].includes(plan.status) && <button className="ghost-button" onClick={() => planAction("close")}>Cerrar día</button>}
          </div>
          {notice && <p className="inline-notice" role="status">{notice}</p>}
          {state.error && <p className="error-banner">{state.error}</p>}
        </div>
        <div className="map-panel">
          <LiveMap position={state.position} markers={(plan?.stops ?? []).filter((stop) => !["completed", "cancelled", "skipped"].includes(stop.status)).map((stop) => ({ id: stop.id, label: stop.clientLabel, latitude: stop.latitude, longitude: stop.longitude, active: stop.id === current?.id }))} />
          {state.position && <div className="vehicle-live-badge"><span>🚗</span><div><strong>Vehículo</strong><small>Ubicación actualizada</small></div></div>}
          <div className="map-caption"><span>Próxima parada</span><strong>{current ? `${current.clientLabel} · ${formatTime(current.etaAt)}` : "Iniciá el recorrido"}</strong></div>
        </div>
      </section>

      <section className="onboarding-guide" aria-labelledby="onboarding-guide-title">
        <div className="guide-intro">
          <p className="eyebrow">Tu primera prueba</p>
          <h2 id="onboarding-guide-title">Probalo en cinco pasos.</h2>
          <p>No necesitás configurar nada más. Armá una visita ficticia y recorré el flujo completo como si fuera un día de trabajo.</p>
        </div>
        <ol className="guide-steps">
          <li><span>01</span><div><strong>Creá una agenda</strong><p>Tocá <b>+ Nueva agenda</b>, elegí la fecha y agregá una o varias visitas con sus horarios.</p></div></li>
          <li><span>02</span><div><strong>Marcá cada visita en el mapa</strong><p>Elegí la parada que querés ubicar y hacé clic en el punto exacto del mapa. No necesitás buscar ni escribir una dirección.</p></div></li>
          <li><span>03</span><div><strong>Compartí el enlace</strong><p>Cuando crees la agenda, usá <b>Copiar enlace</b>. Cada cliente recibe un vínculo privado que muestra únicamente su visita.</p></div></li>
          <li><span>04</span><div><strong>Iniciá el recorrido</strong><p>Al tocar <b>Iniciar recorrido</b>, el cliente puede ver el estado, la hora estimada y tu GPS. Si pausás, la ubicación desaparece.</p></div></li>
          <li><span>05</span><div><strong>Actualizá y cerrá</strong><p>Marcá llegada, completá la visita o agregá una demora. Al final, tocá <b>Cerrar día</b> para detener el seguimiento.</p></div></li>
        </ol>
        <div className="guide-test-tip"><strong>Consejo para probarlo ahora</strong><p>Creá una visita para vos, copiá el enlace del cliente y abrilo en una ventana de incógnito. Así vas a ver exactamente lo que verá la persona que te espera.</p></div>
      </section>

      <section className="agenda-section" aria-labelledby="agenda-title">
        <div className="section-heading"><div><p className="eyebrow">Orden manual · enlaces privados</p><h2 id="agenda-title">Agenda del día</h2></div><span className="privacy-note">GPS visible solo durante el recorrido</span></div>
        <div className="stop-list">
          {(plan?.stops ?? []).map((stop, index) => (
            <article className={`stop-card${selectedId === stop.id ? " is-selected" : ""}`} key={stop.id}>
              <div className="reorder-buttons"><button onClick={() => move(stop, -1)} disabled={index === 0} aria-label="Subir parada">↑</button><button onClick={() => move(stop, 1)} disabled={index === (plan?.stops.length ?? 0) - 1} aria-label="Bajar parada">↓</button></div>
              <div className="stop-order">{String(index + 1).padStart(2, "0")}</div>
              <button className="stop-main-button" onClick={() => setSelectedId(selectedId === stop.id ? null : stop.id)}>
                <span>{formatTime(stop.windowStart)}–{formatTime(stop.windowEnd)} · ETA {formatTime(stop.etaAt)}</span><strong>{stop.clientLabel}</strong><small>{stop.destinationAddress}</small>
              </button>
              <span className={`status status-${stop.status}`}>{statusLabels[stop.status]}</span>
              <button className="copy-button" onClick={() => copyLink(stop)}>Copiar enlace</button>
              {selectedId === stop.id && <StopActions stop={stop} onAction={stopAction} />}
            </article>
          ))}
          {!plan && <div className="empty-state"><h3>Todavía no hay una agenda.</h3><p>La API está lista para crear planes diarios con varias paradas.</p></div>}
        </div>
      </section>
      {creating && <NewPlanDialog token={token} onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); setViewPlanId(id); await load(); }} />}
    </main>
  );
}

function StopActions({ stop, onAction }: { stop: StopView; onAction: (stop: StopView, action: string, body?: unknown) => Promise<void> }) {
  const terminal = ["completed", "skipped", "cancelled"].includes(stop.status);
  return <div className="stop-actions">
    {!terminal && stop.status !== "in_service" && <button onClick={() => onAction(stop, "arrive")}>Marcar llegada</button>}
    {!terminal && <button className="action-primary" onClick={() => onAction(stop, "complete")}>Completar</button>}
    {!terminal && <button onClick={() => onAction(stop, "skip")}>Omitir</button>}
    {!terminal && <button onClick={() => onAction(stop, "cancel")}>Cancelar</button>}
    <div className="delay-group"><span>Demora</span>{[-15, 0, 15, 30, 60].map((minutes) => <button className={stop.manualDelayMinutes === minutes ? "selected" : ""} onClick={() => onAction(stop, "adjust-delay", { minutes })} key={minutes}>{minutes === 0 ? "Reset" : `${minutes > 0 ? "+" : ""}${minutes}`}</button>)}</div>
    <button onClick={() => onAction(stop, "rotate-link")}>Rotar enlace</button>
    <button className="danger-link" onClick={() => onAction(stop, "revoke")}>Revocar</button>
  </div>;
}

type DraftStop = { clientLabel: string; destinationAddress: string; latitude: number; longitude: number; locationConfirmed: boolean; start: string; end: string; duration: number };
const emptyStop = (): DraftStop => ({ clientLabel: "", destinationAddress: "", latitude: -34.6037, longitude: -58.3816, locationConfirmed: false, start: "09:00", end: "10:00", duration: 60 });

function NewPlanDialog({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [serviceDate, setServiceDate] = useState(today());
  const [drafts, setDrafts] = useState<DraftStop[]>([emptyStop()]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [mapTargetIndex, setMapTargetIndex] = useState(0);

  function update(index: number, patch: Partial<DraftStop>) {
    setDrafts((current) => current.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop));
  }

  function selectPoint(point: { latitude: number; longitude: number }) {
    update(mapTargetIndex, { ...point, locationConfirmed: true, destinationAddress: drafts[mapTargetIndex].destinationAddress.trim() || `Punto seleccionado · Parada ${mapTargetIndex + 1}` });
    setMessage(`✓ Parada ${mapTargetIndex + 1} ubicada. Podés continuar con la siguiente.`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (drafts.some((stop) => !stop.clientLabel.trim())) return setMessage("Completá el nombre interno de cada parada.");
    const missingPoint = drafts.findIndex((stop) => !stop.locationConfirmed);
    if (missingPoint >= 0) { setMapTargetIndex(missingPoint); return setMessage(`Elegí en el mapa el punto de la parada ${missingPoint + 1}.`); }
    setSaving(true); setMessage("Creando agenda…");
    const response = await fetch("/api/technician/plans", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ serviceDate, stops: drafts.map((stop) => ({ clientLabel: stop.clientLabel, destinationAddress: stop.destinationAddress, latitude: stop.latitude, longitude: stop.longitude, windowStart: new Date(`${serviceDate}T${stop.start}:00-03:00`).toISOString(), windowEnd: new Date(`${serviceDate}T${stop.end}:00-03:00`).toISOString(), plannedServiceMinutes: stop.duration })) }) });
    const payload = await response.json() as { plan?: PlanView; error?: string };
    if (!response.ok || !payload.plan) { setSaving(false); setMessage(payload.error ?? "No se pudo crear la agenda."); return; }
    await onCreated(payload.plan.id);
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="plan-dialog" role="dialog" aria-modal="true" aria-labelledby="new-plan-title">
      <div className="dialog-heading"><div><p className="eyebrow">Planificar recorrido</p><h2 id="new-plan-title">Nueva agenda</h2></div><button className="dialog-close" onClick={onClose} aria-label="Cerrar">×</button></div>
      <form onSubmit={submit}>
        <label className="field date-field"><span>Fecha del servicio</span><input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} required /></label>
        <div className="draft-stops">{drafts.map((stop, index) => <fieldset className={`draft-stop${mapTargetIndex === index ? " is-map-target" : ""}`} key={index}><legend>Parada {index + 1}</legend><div className="form-grid map-only-grid"><label className="field"><span>Nombre interno</span><input value={stop.clientLabel} onChange={(event) => update(index, { clientLabel: event.target.value })} placeholder="Ej. Familia García" required /></label><label className="field location-reference"><span>Referencia (opcional)</span><input value={stop.destinationAddress.startsWith("Punto seleccionado ·") ? "" : stop.destinationAddress} onChange={(event) => update(index, { destinationAddress: event.target.value })} placeholder="Ej. Casa con portón negro" /></label><label className="field"><span>Desde</span><input type="time" value={stop.start} onChange={(event) => update(index, { start: event.target.value })} required /></label><label className="field"><span>Hasta</span><input type="time" value={stop.end} onChange={(event) => update(index, { end: event.target.value })} required /></label><label className="field"><span>Duración</span><select value={stop.duration} onChange={(event) => update(index, { duration: Number(event.target.value) })}><option value={30}>30 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option></select></label><button className={`pick-map-button${stop.locationConfirmed ? " is-confirmed" : ""}`} type="button" aria-pressed={mapTargetIndex === index} onClick={() => { setMapTargetIndex(index); setMessage(`Hacé clic en el mapa para ubicar la parada ${index + 1}.`); }}>{mapTargetIndex === index ? "📍 Marcá el punto en el mapa" : stop.locationConfirmed ? "✓ Punto elegido · Cambiar" : "Elegir esta parada en el mapa"}</button></div>{drafts.length > 1 && <button className="remove-stop" type="button" onClick={() => { setDrafts((current) => current.filter((_, stopIndex) => stopIndex !== index)); setMapTargetIndex(0); }}>Quitar parada</button>}</fieldset>)}</div>
        <div className="dialog-map"><div className="map-pick-banner"><strong>📍 Ubicando parada {mapTargetIndex + 1}</strong><span>Hacé clic en el mapa. No necesitás escribir la dirección.</span></div><LiveMap markers={drafts.flatMap((stop, index) => stop.locationConfirmed ? [{ id: String(index), label: stop.clientLabel || `Parada ${index + 1}`, latitude: stop.latitude, longitude: stop.longitude, active: index === mapTargetIndex }] : [])} compact selectionMode onPointSelect={selectPoint} /></div>
        {message && <p className="dialog-message" role="status">{message}</p>}
        <div className="dialog-footer"><button type="button" className="add-stop" onClick={() => { setMapTargetIndex(drafts.length); setDrafts([...drafts, emptyStop()]); setMessage("Hacé clic en el mapa para ubicar la nueva parada."); }}>+ Agregar parada</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Creando…" : "Crear agenda"}</button></div>
      </form>
    </section>
  </div>;
}
