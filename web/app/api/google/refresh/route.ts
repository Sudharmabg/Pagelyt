import { userFromRequest } from "@/lib/auth";
import { googleOn } from "@/lib/google/oauth";
import { canUseGoogle, getCache, getConnection, getLink, hasScope, isStale, ownSite, refreshGa4, refreshGsc, type CacheRow } from "@/lib/google/store";
import { rateLimit } from "@/lib/scan/store";

/* POST {siteId, product?, force?}: refetches Search Console (product "gsc", the default) or Analytics ("ga4") for a
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
  const ga = body.product === "ga4";
  const site = await ownSite(body.siteId, user.id);
  if (!site) return no("Site not found.", 404);
  const conn = await getConnection(user.id);
  if (!conn || !hasScope(conn, ga ? "ga4" : "gsc")) return no("Connect Google first.", 409);
  const link = await getLink(site.id);
  if (ga ? !link?.ga4_property : !link?.gsc_property) return no(`Pick ${ga ? "an Analytics" : "a Search Console"} property first.`, 409);

  const old = await getCache(site.id, ga ? "ga4" : "gsc");
  if (!isStale(old) && body.force !== true) return Response.json(view(old!), { headers: { "cache-control": "no-store" } });
  if (!(await rateLimit(`${ga ? "ga4" : "gsc"}-refresh:${site.id}`, body.force === true ? 6 : 30, 3600))) return no("Refreshed a lot just now. Try again in an hour.", 429);

  const res = ga ? await refreshGa4(site, conn, link!) : await refreshGsc(site, conn, link!.gsc_property!);
  if ("revoked" in res) return no("Google access was removed. Connect Google again.", 409);
  return Response.json(view(res), { headers: { "cache-control": "no-store" } });
}

const view = (c: CacheRow<unknown>) => ({ data: c.data, error: c.error, fetchedAt: c.fetched_at, stale: isStale(c) });
