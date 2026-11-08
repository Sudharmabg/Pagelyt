import { adminFromRequest } from "@/lib/auth";
import { pingUptime } from "@/lib/scan/admin";

/* Admin panel: ping every site with uptime monitoring on and record the results. */
export async function POST(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  try {
    return Response.json(await pingUptime());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Uptime check failed." }, { status: 502 });
  }
}
