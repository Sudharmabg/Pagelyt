import { adminFromRequest } from "@/lib/auth";
import { ScanError, TOTAL_STAGES, checkUrl } from "@/lib/scan";
import { startSiteRescan } from "@/lib/scan/admin";
import { createScan, getSite } from "@/lib/scan/store";

/* Admin panel. `{siteId}`: start a rescan of any saved site, as the schedule would. `{url}`: scan any website to
   share (Scan tab); the report belongs to nobody until someone signs in through its link (migration 0014).
   Either way the browser then calls /api/scan/:id/step until done. */
export async function POST(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const { siteId, url: raw } = (await req.json().catch(() => ({}))) as { siteId?: string; url?: string };

  if (typeof raw === "string" && raw.trim()) {
    let url: URL;
    try {
      url = checkUrl(raw.trim().slice(0, 2048));
    } catch (e) {
      return Response.json({ error: e instanceof ScanError ? e.message : "Invalid address." }, { status: 422 });
    }
    const host = url.hostname.replace(/^www\./, "");
    try {
      const id = await createScan({ url: url.href, host, invitedBy: a.user.id });
      return Response.json({ id, host, total: TOTAL_STAGES });
    } catch {
      return Response.json({ error: "Could not start the scan. If this is the first one, run migration 0014 in Supabase first (see DEPLOY.md)." }, { status: 503 });
    }
  }

  const site = siteId ? await getSite(siteId) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });
  return Response.json(await startSiteRescan(site));
}
