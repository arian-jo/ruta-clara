interface D1Result<T = unknown> {
  success: boolean;
  results: T[];
  meta: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
  dump(): Promise<ArrayBuffer>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  IMAGES: unknown;
  APP_DEMO_MODE?: string;
  TECHNICIAN_ACCESS_TOKEN?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  ORS_API_KEY?: string;
  TRACCAR_BASE_URL?: string;
  TRACCAR_API_TOKEN?: string;
  TRACCAR_USERNAME?: string;
  TRACCAR_PASSWORD?: string;
  TRACCAR_DEVICE_ID?: string;
}

declare module "cloudflare:workers" {
  export const env: CloudflareEnv;
}
