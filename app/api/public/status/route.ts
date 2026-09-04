import { apiError, json, publicToken } from "@/lib/server/auth";
import { friendlyStatus, punctualityFor, stopsAhead } from "@/lib/eta";
import { latestTechnicianPosition } from "@/lib/server/integrations";
import { findPublicStop, maintainRetention, recomputePlan } from "@/lib/server/repository";
import { isServiceExpired, trackingDecision } from "@/lib/tracking-policy";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function GET(request: Request) {
  try {
    await maintainRetention();
    const token = publicToken(request);
    if (!token) return json({ error: "Enlace inválido." }, { status: 401 });
    let record = await findPublicStop(token);
    if (!record) return json({ error: "Este enlace no existe o fue reemplazado." }, { status: 404 });

    const position = await latestTechnicianPosition();
    if (record.plan.status === "active") {
      await recomputePlan(record.plan.id, position);
      record = await findPublicStop(token) ?? record;
    }
    const index = record.planStops.findIndex((item) => item.id === record.stop.id);
    const ahead = stopsAhead(record.planStops.map((item) => item.status), index);
    const punctuality = punctualityFor(record.stop.etaAt, record.stop.windowStart, record.stop.windowEnd);
    const expired = isServiceExpired(record.plan.serviceDate, today(), record.plan.status);
    const { visible, reason } = trackingDecision({ planStatus: record.plan.status, stopStatus: record.stop.status, revokedAt: record.stop.revokedAt, expired, position });

    return json({
      serviceDate: record.plan.serviceDate,
      window: { start: record.stop.windowStart, end: record.stop.windowEnd },
      stopStatus: record.stop.status,
      stopsAhead: ahead,
      eta: { at: record.stop.etaAt, updatedAt: record.stop.etaUpdatedAt },
      punctuality,
      tracking: { visible, reason, position: visible ? position : null },
      message: friendlyStatus(record.stop.status, punctuality, ahead),
    });
  } catch (error) { return apiError(error); }
}
