import { adminFromRequest } from "@/lib/auth";
import { adminOverview } from "@/lib/scan/admin";
import { storeMode } from "@/lib/scan/store";

/* Admin panel: every saved site with its schedule, latest score and AI check status. */
export async function GET(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  try {
    return Response.json({ sites: await adminOverview(), mode: storeMode() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load sites." }, { status: 503 });
  }
}
