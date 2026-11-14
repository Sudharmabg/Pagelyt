import { userFromRequest } from "@/lib/auth";
import { analyseGa4, analyseOn } from "@/lib/google/ga4-ai";
import { analyseAds } from "@/lib/google/ads-ai";
import { analyseGsc, type GscAi } from "@/lib/google/gsc-ai";
import type { AdsAi, AdsData } from "@/lib/google/ads-insights";
import { canUseGoogle, getCache, getLink, isStale, ownSite, putCache } from "@/lib/google/store";
import type { Ga4Ai, Ga4Data } from "@/lib/google/ga4-insights";
import { gscBrief, type GscData } from "@/lib/google/gsc-insights";
import { findingKey } from "@/lib/scan/score";
import { getScanRow, rateLimit } from "@/lib/scan/store";
import type { ScanResult } from "@/lib/scan/types";

/* POST {siteId, scanId, product?, force?}: the AI's insights on this site's Google Analytics (product "ga4", the
   default), Google Ads ("ads") or Search Console ("gsc"), read next to the report the owner has open. Answers from the cache when the
   insights are under 24 hours old and based on the current data; otherwise (or with force, "Analyse again") asks the
   model. Doesn't use the assistant's daily questions; each product has its own limits: 4 a day per site, 20 a day per
   account. */

const H = { "cache-control": "no-store" };
const no = (error: string, status: number) => Response.json({ error }, { status, headers: H });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  if (!analyseOn()) return no("The AI analysis isn't switched on yet (OPENAI_API_KEY is not set).", 503);
  if (!(await canUseGoogle(user.id))) return no("Google data comes with the Professional and Business plans.", 402);
  const body = (await req.json().catch(() => ({}))) as { siteId?: unknown; scanId?: unknown; force?: unknown; product?: unknown };
  if (typeof body.siteId !== "string" || typeof body.scanId !== "string") return no("Open a saved site's report first.", 400);
  const site = await ownSite(body.siteId, user.id);
  if (!site) return no("Site not found.", 404);
  const row = await getScanRow(body.scanId);
  if (!row?.result || row.user_id !== user.id || row.host !== site.host) return no("Report not found.", 404);
  const link = await getLink(site.id);
  const done = new Set(row.fixed ?? []);
  const open = row.result.findings.filter((f) => !done.has(findingKey(f)));
  const res = { ...row.result, findings: open };
  if (body.product === "gsc") return searchAi(site.id, user.id, !!link?.gsc_property, res, body.force === true);
  if (body.product === "ads") return ads(site.id, user.id, link?.ads_customer ? link : null, res, body.force === true, !!link?.gsc_property);
  const ga = link?.ga4_property ? await getCache<Ga4Data>(site.id, "ga4") : null;
  if (!ga?.data) return no("Connect Google Analytics and load its numbers first.", 409);

  const old = await getCache<Ga4Ai>(site.id, "ga4_ai");
  const fresh = old?.data && !isStale(old) && old.data.basedOn === ga.fetched_at;
  if (fresh && body.force !== true) return Response.json(view(old!.data!, old!.fetched_at, ga.fetched_at), { headers: H });
  if (!(await rateLimit(`ga4-ai-site:${site.id}`, 4, 86_400)) || !(await rateLimit(`ga4-ai-user:${user.id}`, 20, 86_400)))
    return no("You've run the AI analysis a lot today. It resets within 24 hours.", 429);

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

const view = (ai: Ga4Ai | AdsAi | GscAi, at: string, dataAt: string) => ({ ...ai, at, current: ai.basedOn === dataAt });

async function ads(siteId: string, userId: string, link: object | null, res: ScanResult, force: boolean, hasGsc: boolean) {
  const d = link ? await getCache<AdsData>(siteId, "ads") : null;
  if (!d?.data) return no("Connect Google Ads and load its numbers first.", 409);
  const old = await getCache<AdsAi>(siteId, "ads_ai");
  if (old?.data && !isStale(old) && old.data.basedOn === d.fetched_at && !force) return Response.json(view(old.data, old.fetched_at, d.fetched_at), { headers: H });
  if (!(await rateLimit(`ads-ai-site:${siteId}`, 4, 86_400)) || !(await rateLimit(`ads-ai-user:${userId}`, 20, 86_400)))
    return no("You've run the AI analysis a lot today. It resets within 24 hours.", 429);
  const gsc = hasGsc ? await getCache<GscData>(siteId, "gsc").catch(() => null) : null;
  try {
    const ai = await analyseAds(d.data, res, d.fetched_at, gsc?.data);
    await putCache(siteId, "ads_ai", ai, null);
    return Response.json(view(ai, new Date().toISOString(), d.fetched_at), { headers: H });
  } catch (e) {
    console.error("ads analyse", e instanceof Error ? e.message : e);
    return no("The AI couldn't analyse your Google Ads just now. Please try again.", 502);
  }
}

async function searchAi(siteId: string, userId: string, linked: boolean, res: ScanResult, force: boolean) {
  const d = linked ? await getCache<GscData>(siteId, "gsc") : null;
  if (!d?.data) return no("Connect Search Console and load its numbers first.", 409);
  const old = await getCache<GscAi>(siteId, "gsc_ai");
  if (old?.data && !isStale(old) && old.data.basedOn === d.fetched_at && !force) return Response.json(view(old.data, old.fetched_at, d.fetched_at), { headers: H });
  if (!(await rateLimit(`gsc-ai-site:${siteId}`, 4, 86_400)) || !(await rateLimit(`gsc-ai-user:${userId}`, 20, 86_400)))
    return no("You've run the AI analysis a lot today. It resets within 24 hours.", 429);
  try {
    const ai = await analyseGsc(d.data, res, d.fetched_at);
    await putCache(siteId, "gsc_ai", ai, null);
    return Response.json(view(ai, new Date().toISOString(), d.fetched_at), { headers: H });
  } catch (e) {
    console.error("gsc analyse", e instanceof Error ? e.message : e);
    return no("The AI couldn't analyse your Search Console just now. Please try again.", 502);
  }
}
