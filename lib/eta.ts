import type { Punctuality, StopStatus } from "./domain";

export function punctualityFor(eta: string | null, windowStart: string, windowEnd: string): Punctuality {
  if (!eta) return "unknown";
  const value = Date.parse(eta);
  if (value < Date.parse(windowStart)) return "ahead";
  if (value > Date.parse(windowEnd)) return "delayed";
  return "on_time";
}

export function stopsAhead(statuses: StopStatus[], currentIndex: number) {
  return statuses.slice(0, currentIndex).filter((status) => status === "planned" || status === "en_route" || status === "in_service").length;
}

export function etaTimeline(args: {
  now: string;
  travelMinutes: number[];
  serviceMinutes: number[];
  statuses: StopStatus[];
  delayMinutes: number[];
}) {
  let cursor = Date.parse(args.now);
  return args.statuses.map((status, index) => {
    if (status === "completed" || status === "skipped" || status === "cancelled") return null;
    cursor += (args.travelMinutes[index] ?? 0) * 60_000;
    cursor += (args.delayMinutes[index] ?? 0) * 60_000;
    const eta = new Date(cursor).toISOString();
    cursor += (args.serviceMinutes[index] ?? 60) * 60_000;
    return eta;
  });
}

export function friendlyStatus(status: StopStatus, punctuality: Punctuality, ahead: number) {
  if (status === "in_service") return "El técnico ya llegó y está trabajando.";
  if (status === "completed") return "La visita fue completada.";
  if (status === "skipped" || status === "cancelled") return "Esta visita ya no está en el recorrido de hoy.";
  if (ahead > 0) return `Quedan ${ahead} ${ahead === 1 ? "visita" : "visitas"} antes de la tuya.`;
  if (punctuality === "delayed") return "El técnico viene demorado. La hora estimada ya fue actualizada.";
  if (punctuality === "ahead") return "El técnico viene adelantado.";
  return "El técnico está en camino y llegará dentro del horario previsto.";
}
