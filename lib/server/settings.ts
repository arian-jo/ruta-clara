import { env } from "cloudflare:workers";

type RuntimeEnv = Record<string, string | undefined>;

export function setting(name: string) {
  return (env as unknown as RuntimeEnv)[name];
}

export function isDemoMode() {
  return setting("APP_DEMO_MODE") === "true";
}

export const demoTechnicianToken = "ruta-clara-demo";
