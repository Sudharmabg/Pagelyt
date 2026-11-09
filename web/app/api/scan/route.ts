import { clientIp, isAdmin, userFromRequest, verifyTurnstile } from "@/lib/auth";
import { rootDomain } from "@/lib/domain";
import { authConfigured } from "@/lib/gotrue";
import { claimDomain, ownerOf } from "@/lib/owners";
import { ScanError, TOTAL_STAGES, checkUrl } from "@/lib/scan";
import { isPaid } from "@/lib/scan/agency";
import { createScan, getSite, live, rateLimit, recentScanId, saveLead, validateLead } from "@/lib/scan/store";
import { checkTicket } from "@/lib/ticket";

const PER_HOUR = 10;
const CACHE_SECONDS = 600;

/* Starts a scan: validates, rate-limits, checks who may scan this website, records the lead and creates the row.
   The work itself happens in POST /api/scan/:id/step, one stage per request.

   With accounts switched on, every scan belongs to an account: a signed-in user, or a brand-new sign-up carrying
   the ticket from /api/auth/signup. A website (root domain) belongs to one account, because pricing is per
   website: anyone else is refused with code "not_owner" and can prove ownership at /claim.
   Competitor scans (`purpose: "compare"`, paid plans) are the one exception: they read a rival's site
   without taking it. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!(await rateLimit(`scan:${ip}`, PER_HOUR, 3600))) {
    return Response.json({ error: "Free scan limit reached. Please try again in an hour." }, { status: 429 });
  }

  let body: { url?: unknown; lead?: Record<string, unknown>; turnstile?: unknown; ticket?: unknown; siteId?: unknown; purpose?: unknown; fresh?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const user = await userFromRequest(req);
  // Signed-in users are already known to us; a new sign-up sends its name and email with the ticket.
  const v = user && !body.lead ? null : validateLead(body.lead);
  if (v && "error" in v) return Response.json({ error: v.error }, { status: 400 });
  // A signed-in visitor's lead always carries their own account email, whatever the form said.
  if (user?.email && v) v.lead.email = user.email.toLowerCase();
  // A visitor who has just created an account arrives with a signed ticket naming that account.
  const newUserId = !user && v ? await checkTicket(body.ticket, v.lead.email) : null;
  const accounts = live() && authConfigured();
  if (!user && !newUserId) {
    if (accounts) return Response.json({ error: "Please log in or create an account to scan a website.", code: "signin" }, { status: 401 });
    // No accounts here (local development without Supabase): the plain form with a human check.
    if (!(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : undefined, ip))) {
      return Response.json({ error: "Please complete the human check and try again." }, { status: 400 });
    }
  }

  let url: URL;
  try {
    url = checkUrl(String(body.url || "").slice(0, 2048));
  } catch (e) {
    return Response.json({ error: e instanceof ScanError ? e.message : "Invalid address." }, { status: 422 });
  }
  const host = url.hostname.replace(/^www\./, "");
  const domain = rootDomain(host);
  const ownerId = user?.id ?? newUserId;

  // Who may scan this website?
  try {
    const compare = body.purpose === "compare";
    if (compare) {
      if (!user || !(await isPaid(user.id))) return Response.json({ error: "Competitor comparisons are on paid plans." }, { status: 403 });
    } else if (ownerId && accounts && !(user && (await isAdmin(user)))) {
      const owner = await ownerOf(domain);
      if (owner && owner.user_id !== ownerId) {
        return Response.json({ error: `${domain} is registered to another account. Log in with that account, or prove you own the site.`, code: "not_owner", domain }, { status: 403 });
      }
      if (!owner && !(await claimDomain(domain, ownerId, !!user?.verified))) {
        return Response.json({ error: `${domain} was just registered to another account.`, code: "not_owner", domain }, { status: 403 });
      }
    }
  } catch {
    return Response.json({ error: "Reports are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }

  // Rescanning a saved site (agency dashboard): the new report joins that site's history.
  let siteId: string | null = null;
  if (user && typeof body.siteId === "string" && body.siteId) {
    const site = await getSite(body.siteId).catch(() => null);
    if (!site || site.user_id !== user.id) return Response.json({ error: "Site not found." }, { status: 404 });
    siteId = site.id;
  }

  try {
    // A deliberate rescan (a saved site's, or the owner's Rescan button) is never served from cache.
    const cached = siteId || (user && body.fresh === true) ? null : await recentScanId(url.href, CACHE_SECONDS, ownerId);
    const id = cached ?? (await createScan({ url: url.href, host, userId: ownerId, siteId }));
    if (v) await saveLead(id, host, v.lead).catch(() => {}); // a lead-storage failure must not block the report
    return Response.json({ id, host, total: TOTAL_STAGES, done: !!cached });
  } catch {
    return Response.json({ error: "Reports are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
