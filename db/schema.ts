import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const dayPlans = sqliteTable("day_plans", {
  id: text("id").primaryKey(),
  serviceDate: text("service_date").notNull(),
  status: text("status", { enum: ["draft", "active", "paused", "closed", "expired"] }).notNull().default("draft"),
  startedAt: text("started_at"),
  pausedAt: text("paused_at"),
  closedAt: text("closed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("day_plans_service_date_idx").on(table.serviceDate), index("day_plans_status_idx").on(table.status)]);

export const stops = sqliteTable("stops", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull().references(() => dayPlans.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  clientLabel: text("client_label").notNull(),
  destinationAddress: text("destination_address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  windowStart: text("window_start").notNull(),
  windowEnd: text("window_end").notNull(),
  plannedServiceMinutes: integer("planned_service_minutes").notNull().default(60),
  manualDelayMinutes: integer("manual_delay_minutes").notNull().default(0),
  status: text("status", { enum: ["planned", "en_route", "in_service", "completed", "skipped", "cancelled"] }).notNull().default("planned"),
  publicTokenHash: text("public_token_hash").notNull(),
  publicTokenCiphertext: text("public_token_ciphertext").notNull(),
  publicTokenIv: text("public_token_iv").notNull(),
  revokedAt: text("revoked_at"),
  arrivedAt: text("arrived_at"),
  completedAt: text("completed_at"),
  etaAt: text("eta_at"),
  etaSource: text("eta_source"),
  etaUpdatedAt: text("eta_updated_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("stops_plan_sequence_idx").on(table.planId, table.sequence), uniqueIndex("stops_public_token_hash_idx").on(table.publicTokenHash)]);

export const latestPositions = sqliteTable("latest_positions", {
  deviceId: text("device_id").primaryKey(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  accuracy: real("accuracy"),
  deviceTime: text("device_time").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});
