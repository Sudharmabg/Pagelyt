import { userFromRequest } from "@/lib/auth";
import { analyseGa4, analyseOn } from "@/lib/google/ga4-ai";
import { canUseGoogle, getCache, getLink, isStale, ownSite, putCache } from "@/lib/google/store";
import type { Ga4Ai, Ga4Data } from "@/lib/google/ga4-insights";
import { gscBrief, type GscData } from "@/lib/google/gsc-insights";
import { findingKey } from "@/lib/scan/score";
import { getScanRow, rateLimit } from "@/lib/scan/store";

/* POST {siteId, scanId, force?}: the AI's insights on this site's Google Analytics, read next to the report the owner
   has open. Answers from the cache when the insights are under 24 hours old and based on the current Analytics data;
   otherwise (or with force, "Analyse again") asks the model. Doesn't use the assistant's daily questions; it has its
   own limits: 4 a day per site, 20 a day per account. */

const H = { "cache-control": "no-store" };
const no = (error: string, status: number) => Response.json({ error }, { status, headers: H });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  if (!analyseOn()) return no("The AI analysis isn't switched on yet (OPENAI_API_KEY is not set).", 503);
  if (!(await canUseGoogle(user.id))) return no("Google data comes with the Professional and Business plans.", 402);
  const body = (await req.json().catch(() => ({}))) as { siteId?: unknown; scanId?: unknown; force?: unknown };
  if (typeof body.siteId !== "string" || typeof body.scanId !== "string") return no("Open a saved site's report first.", 400);
  const site = await ownSite(body.siteId, user.id);
  if (!site) return no("Site not found.", 404);
  const row = await getScanRow(body.scanId);
  if (!row?.result || row.user_id !== user.id || row.host !== site.host) return no("Report not found.", 404);
  const link = await getLink(site.id);
  const ga = link?.ga4_property ? await getCache<Ga4Data>(site.id, "ga4") : null;
  if (!ga?.data) return no("Connect Google Analytics and load its numbers first.", 409);

  const old = await getCache<Ga4Ai>(site.id, "ga4_ai");
  const fresh = old?.data && !isStale(old) && old.data.basedOn === ga.fetched_at;
  if (fresh && body.force !== true) return Response.json(view(old!.data!, old!.fetched_at, ga.fetched_at), { headers: H });
  if (!(await rateLimit(`ga4-ai-site:${site.id}`, 4, 86_400)) || !(await rateLimit(`ga4-ai-user:${user.id}`, 20, 86_400)))
    return no("You've run the AI analysis a lot today. It resets within 24 hours.", 429);

  const done = new Set(row.fixed ?? []);
  const open = row.result.findings.filter((f) => !done.has(findingKey(f)));
  const res = { ...row.result, findings: open };
  const gsc = link?.gsc_property ? await getCache<GscData>(site.id, "gsc").catch(() => null) : null;
  try {
    const ai = await analyseGa4(ga.data, res, ga.fetched_at, gsc?.data ? gscBrief(gsc.data, open, res.url, findingKey) : undefined);
    await putCache(site.id, "ga4_ai", ai, null);
    return Response.json(view(ai, new Date().toISOString(), ga.fetched_at), { headers: H });
  } catch (e) {
    console.error("ga4 analyse", e instanceof Error ? e.message : e);
    return no("The AI couldn't analyse your Analytics just now. Please try again.", 502);
  }
}

const view = (ai: Ga4Ai, at: string, gaAt: string) => ({ ...ai, at, current: ai.basedOn === gaAt });
