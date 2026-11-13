import { userFromRequest } from "@/lib/auth";
import { signPrint } from "@/lib/google/crypto";
import { googleOn } from "@/lib/google/oauth";
import { listProperties } from "@/lib/google/gsc";
import { listGa4Properties } from "@/lib/google/ga4";
import { accessFor, canUseGoogle, getCache, getConnection, getLink, hasScope, isStale, ownSite, type CacheRow } from "@/lib/google/store";
import type { GscData } from "@/lib/google/gsc-insights";
import type { Ga4Ai, Ga4Data } from "@/lib/google/ga4-insights";
import { getScanRow, live } from "@/lib/scan/store";

/* GET ?siteId=<id>[&props=1|&ga4props=1][&scanId=<id>]: the Google connection, the site's linked Search Console and
   Analytics properties and their cached data, plus the AI's Analytics insights. props=1 / ga4props=1 also list the
   properties the connected account can read (Google calls), for the property pickers. With the owner's scanId and
   Analytics data, `printToken` lets the print page include the Analytics section. Without siteId it only describes
   the connection (account page). */

const H = { "cache-control": "no-store" };
const view = <T,>(c: CacheRow<T> | null) => (c ? { data: c.data, error: c.error, fetchedAt: c.fetched_at, stale: isStale(c) } : null);

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401, headers: H });
  const configured = googleOn() && live();
  const allowed = await canUseGoogle(user.id);
  const conn = configured ? await getConnection(user.id) : null;
  const base = { configured, allowed, connected: !!conn, email: conn?.google_email ?? null, gsc: hasScope(conn, "gsc"), ga4: hasScope(conn, "ga4") };

  const p = new URL(req.url).searchParams;
  const siteId = p.get("siteId");
  if (!siteId || !configured) return Response.json(base, { headers: H });
  const site = await ownSite(siteId, user.id);
  if (!site) return Response.json({ error: "Site not found." }, { status: 404, headers: H });

  const link = await getLink(site.id);
  const [cache, ga4Cache, ai] = await Promise.all([
    link?.gsc_property ? getCache<GscData>(site.id, "gsc") : null,
    link?.ga4_property ? getCache<Ga4Data>(site.id, "ga4") : null,
    link?.ga4_property ? getCache<Ga4Ai>(site.id, "ga4_ai") : null,
  ]);

  let properties: string[] | undefined;
  let ga4Properties: { property: string; name: string; account: string }[] | undefined;
  const wantGsc = p.get("props") === "1" && conn && base.gsc;
  const wantGa = p.get("ga4props") === "1" && conn && base.ga4;
  if (wantGsc || wantGa) {
    try {
      const access = await accessFor(conn!);
      if (wantGsc) properties = access ? (await listProperties(access)).map((x) => x.siteUrl) : [];
      if (wantGa) ga4Properties = access ? await listGa4Properties(access) : [];
    } catch {
      if (wantGsc) properties = [];
      if (wantGa) ga4Properties = [];
    }
  }

  const scanId = p.get("scanId");
  let printToken: string | undefined;
  if (scanId && ga4Cache?.data && /^[A-Za-z0-9_-]{6,32}$/.test(scanId)) {
    const row = await getScanRow(scanId).catch(() => null);
    if (row?.user_id === user.id && row.host === site.host) printToken = await signPrint(scanId);
  }

  return Response.json(
    {
      ...base,
      property: link?.gsc_property ?? null,
      properties,
      cache: view(cache),
      ga4Property: link?.ga4_property ?? null,
      ga4Name: link?.ga4_name ?? null,
      ga4Properties,
      ga4Cache: view(ga4Cache),
      ai: ai?.data ? { ...ai.data, at: ai.fetched_at, current: ai.data.basedOn === ga4Cache?.fetched_at } : null,
      printToken,
    },
    { headers: H }
  );
}
