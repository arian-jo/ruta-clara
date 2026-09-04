import { apiError, json, requireTechnician } from "@/lib/server/auth";
import { geocode } from "@/lib/server/integrations";

export async function GET(request: Request) {
  try {
    requireTechnician(request);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 3) return json({ results: [] });
    return json({ results: await geocode(query) });
  } catch (error) { return apiError(error); }
}
