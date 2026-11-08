import { adminFromRequest } from "@/lib/auth";
import { adminAnalytics } from "@/lib/scan/analytics";

/* Admin panel: usage analytics for the last 7, 30 or 90 days. */
export async function GET(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const asked = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(asked) ? asked : 30;
  try {
    return Response.json(await adminAnalytics(days));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load analytics." }, { status: 503 });
  }
}
