import { json } from "@/lib/server/auth";

export async function GET() {
  return json({ ok: true });
}
