import { apiError, json, requireTechnician } from "@/lib/server/auth";
import { updateStopState } from "@/lib/server/repository";

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    requireTechnician(request);
    const { id, action } = await context.params;
    const payload = request.headers.get("content-type")?.includes("application/json") ? await request.json() as { minutes?: number } : {};
    await updateStopState(id, action, payload);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
