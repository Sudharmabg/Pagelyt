import { clientIp, userFromRequest, verifyTurnstile } from "@/lib/auth";
import { ScanError, TOTAL_STAGES, checkUrl } from "@/lib/scan";
import { createScan, getSite, rateLimit, recentScanId, saveLead, validateLead } from "@/lib/scan/store";
import { checkTicket } from "@/lib/ticket";

const PER_HOUR = 10;
const CACHE_SECONDS = 600;

/* Starts a scan: validates, rate-limits, records the lead and creates the scan row.
   The work itself happens in POST /api/scan/:id/step, one stage per request. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!(await rateLimit(`scan:${ip}`, PER_HOUR, 3600))) {
    return Response.json({ error: "Free scan limit reached. Please try again in an hour." }, { status: 429 });
  }

  let body: { url?: unknown; lead?: Record<string, unknown>; turnstile?: unknown; ticket?: unknown; siteId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const user = await userFromRequest(req);
  // Signed-in users are already known to us; everyone else leaves contact details first.
  const v = user && !body.lead ? null : validateLead(body.lead);
  if (v && "error" in v) return Response.json({ error: v.error }, { status: 400 });
  // A signed-in visitor's lead always carries their own account email, whatever the form said.
  if (user?.email && v) v.lead.email = user.email.toLowerCase();
  // A visitor who has just created an account arrives with a signed ticket instead of a second human check.
  const ticketOk = !user && !!v && (await checkTicket(body.ticket, v.lead.email));
  if (!user && !ticketOk && !(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : undefined, ip))) {
    return Response.json({ error: "Please complete the human check and try again." }, { status: 400 });
  }

  let url: URL;
  try {
    url = checkUrl(String(body.url || "").slice(0, 2048));
  } catch (e) {
    return Response.json({ error: e instanceof ScanError ? e.message : "Invalid address." }, { status: 422 });
  }
  const host = url.hostname.replace(/^www\./, "");

  // Rescanning a saved site (agency dashboard): the new report joins that site's history.
  let siteId: string | null = null;
  if (user && typeof body.siteId === "string" && body.siteId) {
    const site = await getSite(body.siteId).catch(() => null);
    if (!site || site.user_id !== user.id) return Response.json({ error: "Site not found." }, { status: 404 });
    siteId = site.id;
  }

  try {
    const cached = siteId ? null : await recentScanId(url.href, CACHE_SECONDS, user?.id); // a deliberate rescan is never served from cache
    const id = cached ?? (await createScan({ url: url.href, host, userId: user?.id, siteId }));
    if (v) await saveLead(id, host, v.lead).catch(() => {}); // a lead-storage failure must not block the report
    return Response.json({ id, host, total: TOTAL_STAGES, done: !!cached });
  } catch {
    return Response.json({ error: "Reports are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
