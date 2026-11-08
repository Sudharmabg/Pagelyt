import { userFromRequest } from "@/lib/auth";
import { isPaid, sitesOverview } from "@/lib/scan/agency";

/* Agency dashboard data: every saved site with its latest score, change, weakest area and trend.
   Paid plans only. Browser sends: Authorization: Bearer <access token>. */
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await isPaid(user.id).catch(() => false))) return Response.json({ error: "The agency dashboard comes with any paid plan.", upgrade: true }, { status: 403 });
  try {
    return Response.json({ sites: await sitesOverview(user.id) });
  } catch {
    return Response.json({ error: "Could not load your sites. Please try again." }, { status: 503 });
  }
}
