import { adminFromRequest } from "@/lib/auth";
import { startSiteRescan } from "@/lib/scan/admin";
import { getSite } from "@/lib/scan/store";

/* Admin panel: start a rescan of any saved site, as the schedule would. The browser then calls
   /api/scan/:id/step until done; the score-drop alert fires as usual when it finishes. */
export async function POST(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  const site = siteId ? await getSite(siteId) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });
  return Response.json(await startSiteRescan(site));
}
