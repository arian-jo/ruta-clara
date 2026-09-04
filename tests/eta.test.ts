import assert from "node:assert/strict";
import test from "node:test";
import { etaTimeline, punctualityFor, stopsAhead } from "../lib/eta.ts";

test("clasifica adelanto, puntualidad y demora contra la franja", () => {
  assert.equal(punctualityFor("2026-08-15T11:45:00Z", "2026-08-15T12:00:00Z", "2026-08-15T13:00:00Z"), "ahead");
  assert.equal(punctualityFor("2026-08-15T12:30:00Z", "2026-08-15T12:00:00Z", "2026-08-15T13:00:00Z"), "on_time");
  assert.equal(punctualityFor("2026-08-15T13:01:00Z", "2026-08-15T12:00:00Z", "2026-08-15T13:00:00Z"), "delayed");
});

test("propaga duración, viaje y correcciones manuales a las visitas siguientes", () => {
  const values = etaTimeline({ now: "2026-08-15T12:00:00Z", travelMinutes: [10, 20, 15], serviceMinutes: [30, 60, 45], statuses: ["en_route", "planned", "planned"], delayMinutes: [15, 0, 0] });
  assert.deepEqual(values, ["2026-08-15T12:25:00.000Z", "2026-08-15T13:15:00.000Z", "2026-08-15T14:30:00.000Z"]);
});

test("no cuenta trabajos ya cerrados por delante", () => {
  assert.equal(stopsAhead(["completed", "skipped", "en_route", "planned"], 3), 1);
});
