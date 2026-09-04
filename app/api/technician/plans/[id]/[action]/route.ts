import { apiError, json, requireTechnician } from "@/lib/server/auth";
import { updatePlanState } from "@/lib/server/repository";

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    requireTechnician(request);
    const { id, action } = await context.params;
    await updatePlanState(id, action);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
