import { apiError, json, requireTechnician } from "@/lib/server/auth";
import { latestTechnicianPosition } from "@/lib/server/integrations";
import { createPlan, listPlans } from "@/lib/server/repository";

export async function GET(request: Request) {
  try {
    requireTechnician(request);
    const [plans, position] = await Promise.all([
      listPlans(new URL(request.url).origin),
      latestTechnicianPosition(),
    ]);
    return json({ plans, position });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireTechnician(request);
    const payload = await request.json() as Parameters<typeof createPlan>[0];
    return json({ plan: await createPlan(payload, new URL(request.url).origin) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
