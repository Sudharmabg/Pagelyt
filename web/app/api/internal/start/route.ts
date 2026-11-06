import { createScan, getSite, scheduleSiteScan } from "@/lib/scan/store";
import { TOTAL_STAGES } from "@/lib/scan/labels";

/* For the cron Worker: start a scheduled rescan of a saved site. The Worker then calls
   /api/scan/:id/step until done, so each stage gets its own request budget. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  const site = siteId ? await getSite(siteId) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });
  const id = await createScan({ url: site.url, host: site.host, userId: site.user_id, siteId: site.id });
  await scheduleSiteScan(site, id); // moves next_run_at forward first, so a failed run is not retried every minute
  return Response.json({ id, total: TOTAL_STAGES });
}
