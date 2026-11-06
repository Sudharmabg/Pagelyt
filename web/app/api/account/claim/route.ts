import { userFromRequest } from "@/lib/auth";
import { getScanRow, saveSite, storeMode, type Site } from "@/lib/scan/store";

/* Signed-in users save a finished report to their account. This also records the site, with an
   optional rescan schedule and uptime monitoring. Browser sends: Authorization: Bearer <access token>. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (storeMode() !== "supabase") return Response.json({ error: "Accounts need Supabase to be configured." }, { status: 501 });

  let body: { scanId?: string; cadence?: Site["cadence"]; uptime?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const cadences = ["none", "daily", "weekly", "monthly"];
  if (body.cadence && !cadences.includes(body.cadence)) return Response.json({ error: "Invalid schedule." }, { status: 400 });

  const scan = await getScanRow(String(body.scanId || ""));
  if (!scan || scan.status !== "done") return Response.json({ error: "Report not found." }, { status: 404 });
  if (scan.user_id && scan.user_id !== user.id) return Response.json({ error: "This report belongs to another account." }, { status: 403 });

  try {
    const site = await saveSite(user.id, { id: scan.id, host: scan.host, url: scan.url }, { cadence: body.cadence, uptime: body.uptime });
    return Response.json({ site });
  } catch {
    return Response.json({ error: "Could not save the site. Please try again." }, { status: 500 });
  }
}
