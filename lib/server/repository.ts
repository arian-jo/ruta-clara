import { and, asc, desc, eq, lt } from "drizzle-orm";
import { dayPlans, stops } from "@/db/schema";
import { ensureDatabase, getDb } from "@/db";
import { etaTimeline } from "@/lib/eta";
import type { PlanView, Position, StopStatus, StopView } from "@/lib/domain";
import { decryptToken, encryptToken, hashToken, newPublicToken } from "./tokens";
import { latestTechnicianPosition, routeTravelMinutes } from "./integrations";
import { isDemoMode } from "./settings";
import { planStatusAfter, stopStatusAfter } from "@/lib/tracking-policy";

const terminalStatuses: StopStatus[] = ["completed", "skipped", "cancelled"];

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function yesterday() {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - 1);
  return localDate(value);
}

function isoAt(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

async function tokenFields() {
  const token = newPublicToken();
  const encrypted = await encryptToken(token);
  return { token, publicTokenHash: await hashToken(token), publicTokenCiphertext: encrypted.ciphertext, publicTokenIv: encrypted.iv };
}

export async function maintainRetention() {
  await ensureDatabase();
  const db = getDb();
  await db.update(dayPlans).set({ status: "expired", updatedAt: new Date().toISOString() }).where(and(lt(dayPlans.serviceDate, localDate()), eq(dayPlans.status, "active")));
  await db.delete(dayPlans).where(lt(dayPlans.serviceDate, yesterday()));
}

async function seedDemo() {
  if (!isDemoMode()) return;
  const db = getDb();
  const [existing] = await db.select({ id: dayPlans.id }).from(dayPlans).where(eq(dayPlans.serviceDate, localDate())).limit(1);
  if (existing) return;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(dayPlans).values({ id, serviceDate: localDate(), status: "draft", createdAt: now, updatedAt: now });
  const samples = [
    { clientLabel: "Visita norte", destinationAddress: "Punto de muestra en zona norte", latitude: -34.4938, longitude: -58.5101, start: "09:00", end: "10:00" },
    { clientLabel: "Visita centro", destinationAddress: "Punto de muestra en CABA", latitude: -34.5733, longitude: -58.4825, start: "11:30", end: "12:30" },
    { clientLabel: "Visita sur", destinationAddress: "Punto de muestra en CABA", latitude: -34.6228, longitude: -58.4374, start: "15:00", end: "16:00" },
  ];
  for (const [index, sample] of samples.entries()) {
    const fields = await tokenFields();
    await db.insert(stops).values({
      id: crypto.randomUUID(), planId: id, sequence: index, clientLabel: sample.clientLabel,
      destinationAddress: sample.destinationAddress, latitude: sample.latitude, longitude: sample.longitude,
      windowStart: isoAt(localDate(), sample.start), windowEnd: isoAt(localDate(), sample.end), plannedServiceMinutes: 60,
      manualDelayMinutes: 0, status: "planned", publicTokenHash: fields.publicTokenHash,
      publicTokenCiphertext: fields.publicTokenCiphertext, publicTokenIv: fields.publicTokenIv, createdAt: now, updatedAt: now,
    });
  }
}

function publicUrl(origin: string, token: string) {
  return `${origin}/seguimiento#token=${token}`;
}

async function toStopView(row: typeof stops.$inferSelect, origin: string): Promise<StopView> {
  const token = await decryptToken(row.publicTokenCiphertext, row.publicTokenIv);
  return {
    id: row.id, planId: row.planId, sequence: row.sequence, clientLabel: row.clientLabel,
    destinationAddress: row.destinationAddress, latitude: row.latitude, longitude: row.longitude,
    windowStart: row.windowStart, windowEnd: row.windowEnd, plannedServiceMinutes: row.plannedServiceMinutes,
    manualDelayMinutes: row.manualDelayMinutes, status: row.status, publicUrl: publicUrl(origin, token),
    revokedAt: row.revokedAt, etaAt: row.etaAt, etaUpdatedAt: row.etaUpdatedAt,
  };
}

export async function listPlans(origin: string): Promise<PlanView[]> {
  await maintainRetention();
  await seedDemo();
  const db = getDb();
  const plans = await db.select().from(dayPlans).orderBy(desc(dayPlans.serviceDate));
  const result: PlanView[] = [];
  for (const plan of plans) {
    const rows = await db.select().from(stops).where(eq(stops.planId, plan.id)).orderBy(asc(stops.sequence));
    result.push({ ...plan, stops: await Promise.all(rows.map((row) => toStopView(row, origin))) });
  }
  return result;
}

type NewStop = { clientLabel: string; destinationAddress: string; latitude: number; longitude: number; windowStart: string; windowEnd: string; plannedServiceMinutes?: number };

export async function createPlan(payload: { serviceDate: string; stops: NewStop[] }, origin: string) {
  await ensureDatabase();
  if (!payload.serviceDate || !payload.stops?.length) throw new Error("La fecha y al menos una parada son obligatorias.");
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(dayPlans).values({ id, serviceDate: payload.serviceDate, status: "draft", createdAt: now, updatedAt: now });
  for (const [index, stop] of payload.stops.entries()) {
    const fields = await tokenFields();
    await db.insert(stops).values({ id: crypto.randomUUID(), planId: id, sequence: index, clientLabel: stop.clientLabel.trim(), destinationAddress: stop.destinationAddress.trim(), latitude: stop.latitude, longitude: stop.longitude, windowStart: stop.windowStart, windowEnd: stop.windowEnd, plannedServiceMinutes: stop.plannedServiceMinutes ?? 60, manualDelayMinutes: 0, status: "planned", publicTokenHash: fields.publicTokenHash, publicTokenCiphertext: fields.publicTokenCiphertext, publicTokenIv: fields.publicTokenIv, createdAt: now, updatedAt: now });
  }
  return (await listPlans(origin)).find((plan) => plan.id === id);
}

export async function reorderPlan(planId: string, orderedIds: string[]) {
  await ensureDatabase();
  const db = getDb();
  for (const [sequence, id] of orderedIds.entries()) await db.update(stops).set({ sequence, updatedAt: new Date().toISOString() }).where(and(eq(stops.id, id), eq(stops.planId, planId)));
  await recomputePlan(planId);
}

export async function updatePlanState(planId: string, action: string) {
  await ensureDatabase();
  const db = getDb();
  const now = new Date().toISOString();
  const state: Partial<typeof dayPlans.$inferInsert> = { updatedAt: now };
  const status = planStatusAfter(action);
  if (action === "start") Object.assign(state, { status, startedAt: now, pausedAt: null });
  else if (action === "pause") Object.assign(state, { status, pausedAt: now });
  else if (action === "resume") Object.assign(state, { status, pausedAt: null });
  else if (action === "close") Object.assign(state, { status, closedAt: now });
  await db.update(dayPlans).set(state).where(eq(dayPlans.id, planId));
  if (action === "start") {
    const [first] = await db.select().from(stops).where(and(eq(stops.planId, planId), eq(stops.status, "planned"))).orderBy(asc(stops.sequence)).limit(1);
    if (first) await db.update(stops).set({ status: "en_route", updatedAt: now }).where(eq(stops.id, first.id));
  }
  await recomputePlan(planId);
}

export async function updateStopState(stopId: string, action: string, payload: { minutes?: number } = {}) {
  await ensureDatabase();
  const db = getDb();
  const [stop] = await db.select().from(stops).where(eq(stops.id, stopId)).limit(1);
  if (!stop) throw new Error("Parada no encontrada.");
  const now = new Date().toISOString();
  if (action === "arrive") await db.update(stops).set({ status: "in_service", arrivedAt: now, etaAt: now, etaUpdatedAt: now, updatedAt: now }).where(eq(stops.id, stopId));
  else if (action === "complete" || action === "skip" || action === "cancel") {
    const status = stopStatusAfter(action);
    await db.update(stops).set({ status, completedAt: now, updatedAt: now }).where(eq(stops.id, stopId));
    const [next] = await db.select().from(stops).where(and(eq(stops.planId, stop.planId), eq(stops.status, "planned"))).orderBy(asc(stops.sequence)).limit(1);
    if (next) await db.update(stops).set({ status: "en_route", updatedAt: now }).where(eq(stops.id, next.id));
  } else if (action === "adjust-delay") {
    await db.update(stops).set({ manualDelayMinutes: payload.minutes ?? 0, updatedAt: now }).where(eq(stops.id, stopId));
  } else if (action === "revoke") {
    await db.update(stops).set({ revokedAt: now, updatedAt: now }).where(eq(stops.id, stopId));
  } else if (action === "rotate-link") {
    const fields = await tokenFields();
    await db.update(stops).set({ publicTokenHash: fields.publicTokenHash, publicTokenCiphertext: fields.publicTokenCiphertext, publicTokenIv: fields.publicTokenIv, revokedAt: null, updatedAt: now }).where(eq(stops.id, stopId));
  } else throw new Error("Acción no válida.");
  await recomputePlan(stop.planId);
}

export async function recomputePlan(planId: string, knownPosition?: Position | null) {
  await ensureDatabase();
  const db = getDb();
  const rows = await db.select().from(stops).where(eq(stops.planId, planId)).orderBy(asc(stops.sequence));
  const open = rows.filter((stop) => !terminalStatuses.includes(stop.status));
  if (!open.length) return;
  const position = knownPosition === undefined ? await latestTechnicianPosition() : knownPosition;
  const points = [position ? { latitude: position.latitude, longitude: position.longitude } : { latitude: open[0].latitude, longitude: open[0].longitude }, ...open.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude }))];
  const minutes = (await routeTravelMinutes(points)).slice(1);
  const etas = etaTimeline({ now: new Date().toISOString(), travelMinutes: minutes, serviceMinutes: open.map((stop) => stop.plannedServiceMinutes), statuses: open.map((stop) => stop.status), delayMinutes: open.map((stop) => stop.manualDelayMinutes) });
  const updatedAt = new Date().toISOString();
  for (const [index, stop] of open.entries()) await db.update(stops).set({ etaAt: etas[index], etaSource: "route", etaUpdatedAt: updatedAt, updatedAt }).where(eq(stops.id, stop.id));
}

export async function findPublicStop(token: string) {
  await ensureDatabase();
  const db = getDb();
  const [stop] = await db.select().from(stops).where(eq(stops.publicTokenHash, await hashToken(token))).limit(1);
  if (!stop) return null;
  const [plan] = await db.select().from(dayPlans).where(eq(dayPlans.id, stop.planId)).limit(1);
  if (!plan) return null;
  const planStops = await db.select().from(stops).where(eq(stops.planId, plan.id)).orderBy(asc(stops.sequence));
  return { stop, plan, planStops };
}
