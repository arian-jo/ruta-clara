export type PlanStatus = "draft" | "active" | "paused" | "closed" | "expired";
export type StopStatus = "planned" | "en_route" | "in_service" | "completed" | "skipped" | "cancelled";
export type Punctuality = "ahead" | "on_time" | "delayed" | "unknown";

export type Position = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  deviceTime: string;
  fetchedAt: string;
};

export type StopView = {
  id: string;
  planId: string;
  sequence: number;
  clientLabel: string;
  destinationAddress: string;
  latitude: number;
  longitude: number;
  windowStart: string;
  windowEnd: string;
  plannedServiceMinutes: number;
  manualDelayMinutes: number;
  status: StopStatus;
  publicUrl?: string;
  revokedAt: string | null;
  etaAt: string | null;
  etaUpdatedAt: string | null;
};

export type PlanView = {
  id: string;
  serviceDate: string;
  status: PlanStatus;
  startedAt: string | null;
  pausedAt: string | null;
  closedAt: string | null;
  stops: StopView[];
};

export type PublicStatus = {
  serviceDate: string;
  window: { start: string; end: string };
  stopStatus: StopStatus;
  stopsAhead: number;
  eta: { at: string | null; updatedAt: string | null };
  punctuality: Punctuality;
  tracking: {
    visible: boolean;
    reason: "active" | "not_started" | "paused" | "finished" | "revoked" | "expired" | "stale";
    position: Position | null;
  };
  message: string;
};
