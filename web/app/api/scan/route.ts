import { clientIp, userFromRequest, verifyTurnstile } from "@/lib/auth";
import { ScanError, TOTAL_STAGES, checkUrl } from "@/lib/scan";
import { createScan, rateLimit, recentScanId, saveLead, validateLead } from "@/lib/scan/store";

const PER_HOUR = 10;
const CACHE_SECONDS = 600;

/* Starts a scan: validates, rate-limits, records the lead and creates the scan row.
   The work itself happens in POST /api/scan/:id/step, one stage per request. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!(await rateLimit(`scan:${ip}`, PER_HOUR, 3600))) {
    return Response.json({ error: "Free scan limit reached. Please try again in an hour." }, { status: 429 });
  }

  let body: { url?: unknown; lead?: Record<string, unknown>; turnstile?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const user = await userFromRequest(req);
  // Signed-in users are already known to us; everyone else leaves contact details first.
  const v = user && !body.lead ? null : validateLead(body.lead);
  if (v && "error" in v) return Response.json({ error: v.error }, { status: 400 });
  if (!user && !(await verifyTurnstile(body.turnstile, ip))) {
    return Response.json({ error: "Please complete the human check and try again." }, { status: 400 });
  }

  let url: URL;
  try {
    url = checkUrl(String(body.url || "").slice(0, 2048));
  } catch (e) {
    return Response.json({ error: e instanceof ScanError ? e.message : "Invalid address." }, { status: 422 });
  }
  const host = url.hostname.replace(/^www\./, "");

  try {
    const cached = await recentScanId(url.href, CACHE_SECONDS);
    const id = cached ?? (await createScan({ url: url.href, host, userId: user?.id }));
    if (v) await saveLead(id, host, v.lead).catch(() => {}); // a lead-storage failure must not block the report
    return Response.json({ id, host, total: TOTAL_STAGES, done: !!cached });
  } catch {
    return Response.json({ error: "Reports are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
