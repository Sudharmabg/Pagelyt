import { userFromRequest } from "@/lib/auth";
import { googleOn } from "@/lib/google/oauth";
import { listProperties } from "@/lib/google/gsc";
import { accessFor, canUseGoogle, getCache, getConnection, getLink, hasScope, isStale, ownSite } from "@/lib/google/store";
import type { GscData } from "@/lib/google/gsc-insights";
import { live } from "@/lib/scan/store";

/* GET ?siteId=<id>[&props=1]: the Google connection, the site's linked property and its cached Search Console data.
   With props=1 it also lists the Search Console properties the connected account can read (one Google call), for
   the property picker. Without siteId it only describes the connection (account page). */

const H = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401, headers: H });
  const configured = googleOn() && live();
  const allowed = await canUseGoogle(user.id);
  const conn = configured ? await getConnection(user.id) : null;
  const base = { configured, allowed, connected: !!conn, email: conn?.google_email ?? null, gsc: hasScope(conn, "gsc") };

  const p = new URL(req.url).searchParams;
  const siteId = p.get("siteId");
  if (!siteId || !configured) return Response.json(base, { headers: H });
  const site = await ownSite(siteId, user.id);
  if (!site) return Response.json({ error: "Site not found." }, { status: 404, headers: H });

  const link = await getLink(site.id);
  const cache = link?.gsc_property ? await getCache<GscData>(site.id, "gsc") : null;
  let properties: string[] | undefined;
  if (p.get("props") === "1" && conn && base.gsc) {
    try {
      const access = await accessFor(conn);
      properties = access ? (await listProperties(access)).map((x) => x.siteUrl) : [];
    } catch {
      properties = [];
    }
  }
  return Response.json(
    {
      ...base,
      property: link?.gsc_property ?? null,
      properties,
      cache: cache ? { data: cache.data, error: cache.error, fetchedAt: cache.fetched_at, stale: isStale(cache) } : null,
    },
    { headers: H }
  );
}
