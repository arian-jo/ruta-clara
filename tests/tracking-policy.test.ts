import assert from "node:assert/strict";
import test from "node:test";
import { isServiceExpired, planStatusAfter, stopStatusAfter, trackingDecision } from "../lib/tracking-policy.ts";

const freshPosition = { latitude: -34.6, longitude: -58.4, accuracy: 10, deviceTime: "2026-08-15T12:00:00Z", fetchedAt: "2026-08-15T12:00:01Z" };

test("solo comparte GPS para un plan activo y una visita abierta", () => {
  const active = trackingDecision({ planStatus: "active", stopStatus: "en_route", revokedAt: null, expired: false, position: freshPosition, now: Date.parse("2026-08-15T12:01:00Z") });
  assert.deepEqual(active, { visible: true, reason: "active" });
  assert.deepEqual(trackingDecision({ planStatus: "paused", stopStatus: "en_route", revokedAt: null, expired: false, position: freshPosition, now: Date.parse("2026-08-15T12:01:00Z") }), { visible: false, reason: "paused" });
  assert.deepEqual(trackingDecision({ planStatus: "active", stopStatus: "completed", revokedAt: null, expired: false, position: freshPosition, now: Date.parse("2026-08-15T12:01:00Z") }), { visible: false, reason: "finished" });
});

test("oculta posiciones con más de diez minutos", () => {
  assert.deepEqual(trackingDecision({ planStatus: "active", stopStatus: "planned", revokedAt: null, expired: false, position: freshPosition, now: Date.parse("2026-08-15T12:11:00Z") }), { visible: false, reason: "stale" });
});

test("aplica vencimiento y transiciones válidas", () => {
  assert.equal(isServiceExpired("2026-08-14", "2026-08-15", "active"), true);
  assert.equal(planStatusAfter("pause"), "paused");
  assert.equal(planStatusAfter("resume"), "active");
  assert.equal(stopStatusAfter("arrive"), "in_service");
  assert.equal(stopStatusAfter("complete"), "completed");
  assert.throws(() => planStatusAfter("destroy"), /no válida/);
});
