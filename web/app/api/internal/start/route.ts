import { startSiteRescan } from "@/lib/scan/admin";
import { getSite } from "@/lib/scan/store";

/* For the cron Worker: start a scheduled rescan of a saved site. The Worker then calls
   /api/scan/:id/step until done, so each stage gets its own request budget. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  const site = siteId ? await getSite(siteId) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });
  return Response.json(await startSiteRescan(site));
}
