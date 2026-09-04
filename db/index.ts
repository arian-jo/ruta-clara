import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let ready: Promise<void> | undefined;

export function ensureDatabase() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  ready ??= env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS day_plans (id text PRIMARY KEY NOT NULL, service_date text NOT NULL, status text DEFAULT 'draft' NOT NULL, started_at text, paused_at text, closed_at text, created_at text NOT NULL, updated_at text NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS day_plans_service_date_idx ON day_plans (service_date)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS day_plans_status_idx ON day_plans (status)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS latest_positions (device_id text PRIMARY KEY NOT NULL, latitude real NOT NULL, longitude real NOT NULL, accuracy real, device_time text NOT NULL, fetched_at text NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS stops (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, sequence integer NOT NULL, client_label text NOT NULL, destination_address text NOT NULL, latitude real NOT NULL, longitude real NOT NULL, window_start text NOT NULL, window_end text NOT NULL, planned_service_minutes integer DEFAULT 60 NOT NULL, manual_delay_minutes integer DEFAULT 0 NOT NULL, status text DEFAULT 'planned' NOT NULL, public_token_hash text NOT NULL, public_token_ciphertext text NOT NULL, public_token_iv text NOT NULL, revoked_at text, arrived_at text, completed_at text, eta_at text, eta_source text, eta_updated_at text, created_at text NOT NULL, updated_at text NOT NULL, FOREIGN KEY (plan_id) REFERENCES day_plans(id) ON DELETE CASCADE)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS stops_plan_sequence_idx ON stops (plan_id, sequence)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS stops_public_token_hash_idx ON stops (public_token_hash)"),
  ]).then(() => undefined).catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
