import { apiError, json, requireTechnician } from "@/lib/server/auth";
import { reorderPlan } from "@/lib/server/repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireTechnician(request);
    const { id } = await context.params;
    const payload = await request.json() as { orderedIds?: string[] };
    if (!Array.isArray(payload.orderedIds)) return json({ error: "orderedIds es obligatorio." }, { status: 400 });
    await reorderPlan(id, payload.orderedIds);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
