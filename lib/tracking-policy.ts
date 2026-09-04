import type { PlanStatus, Position, StopStatus } from "./domain";

export function isServiceExpired(serviceDate: string, today: string, planStatus: PlanStatus) {
  return serviceDate < today || planStatus === "expired" || planStatus === "closed";
}

export function trackingDecision(args: {
  planStatus: PlanStatus;
  stopStatus: StopStatus;
  revokedAt: string | null;
  expired: boolean;
  position: Position | null;
  now?: number;
}) {
  const terminal = ["completed", "skipped", "cancelled"].includes(args.stopStatus);
  const stale = args.position ? (args.now ?? Date.now()) - Date.parse(args.position.deviceTime) > 10 * 60_000 : true;
  const visible = args.planStatus === "active" && !args.revokedAt && !terminal && !args.expired && !!args.position && !stale;
  const reason = visible ? "active" : args.revokedAt ? "revoked" : terminal ? "finished" : args.expired ? "expired" : args.planStatus === "paused" ? "paused" : stale ? "stale" : "not_started";
  return { visible, reason } as const;
}

export function planStatusAfter(action: string): PlanStatus {
  if (action === "start" || action === "resume") return "active";
  if (action === "pause") return "paused";
  if (action === "close") return "closed";
  throw new Error("Acción no válida.");
}

export function stopStatusAfter(action: string): StopStatus {
  if (action === "arrive") return "in_service";
  if (action === "complete") return "completed";
  if (action === "skip") return "skipped";
  if (action === "cancel") return "cancelled";
  throw new Error("Acción no válida.");
}
