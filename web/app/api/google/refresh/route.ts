import { userFromRequest } from "@/lib/auth";
import { googleOn } from "@/lib/google/oauth";
import { canUseGoogle, getCache, getConnection, getLink, hasScope, isStale, ownSite, refreshAds, refreshGa4, refreshGsc, type CacheRow } from "@/lib/google/store";
import { adsOn } from "@/lib/google/ads";
import { rateLimit } from "@/lib/scan/store";

/* POST {siteId, product?, force?}: refetches Search Console (product "gsc", the default), Analytics ("ga4") or Google Ads ("ads") for a
   site when its cache is older than 24 hours, or right away with force (the Refresh button; 6 an hour per site and
   product). The dashboard calls this when it opens. */

const no = (error: string, status: number) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  if (!googleOn()) return no("Google isn't set up on this server yet.", 503);
  if (!(await canUseGoogle(user.id))) return no("Google data comes with the Professional and Business plans.", 402);
  const body = (await req.json().catch(() => ({}))) as { siteId?: unknown; force?: unknown; product?: unknown };
  if (typeof body.siteId !== "string") return no("Missing site.", 400);
  const product = body.product === "ga4" || body.product === "ads" ? body.product : "gsc";
  if (product === "ads" && !adsOn()) return no("Google Ads isn't set up on this server yet.", 503);
  const site = await ownSite(body.siteId, user.id);
  if (!site) return no("Site not found.", 404);
  const conn = await getConnection(user.id);
  if (!conn || !hasScope(conn, product)) return no("Connect Google first.", 409);
  const link = await getLink(site.id);
  const linked = { gsc: link?.gsc_property, ga4: link?.ga4_property, ads: link?.ads_customer }[product];
  if (!linked) return no(`Pick ${{ gsc: "a Search Console property", ga4: "an Analytics property", ads: "a Google Ads account" }[product]} first.`, 409);

  const old = await getCache(site.id, product);
  if (!isStale(old) && body.force !== true) return Response.json(view(old!), { headers: { "cache-control": "no-store" } });
  if (!(await rateLimit(`${product}-refresh:${site.id}`, body.force === true ? 6 : 30, 3600))) return no("Refreshed a lot just now. Try again in an hour.", 429);

  const res = product === "ads" ? await refreshAds(site, conn, link!) : product === "ga4" ? await refreshGa4(site, conn, link!) : await refreshGsc(site, conn, link!.gsc_property!);
  if ("revoked" in res) return no("Google access was removed. Connect Google again.", 409);
  return Response.json(view(res), { headers: { "cache-control": "no-store" } });
}

const view = (c: CacheRow<unknown>) => ({ data: c.data, error: c.error, fetchedAt: c.fetched_at, stale: isStale(c) });
