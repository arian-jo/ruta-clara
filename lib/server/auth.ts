import { demoTechnicianToken, isDemoMode, setting } from "./settings";

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export function requireTechnician(request: Request) {
  const expected = setting("TECHNICIAN_ACCESS_TOKEN") ?? (isDemoMode() ? demoTechnicianToken : "");
  if (!expected || bearer(request) !== expected) {
    throw new Response(JSON.stringify({ error: "Enlace privado inválido." }), {
      status: 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}

export function publicToken(request: Request) {
  const token = bearer(request);
  return /^[A-Za-z0-9_-]{32}$/.test(token) ? token : "";
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Error inesperado";
  return json({ error: message }, { status: 500 });
}
