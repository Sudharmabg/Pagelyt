import { userFromRequest } from "@/lib/auth";
import { listProperties } from "@/lib/google/gsc";
import { listGa4Properties } from "@/lib/google/ga4";
import { accessFor, canUseGoogle, getConnection, ownSite, setGa4Property, setGscProperty } from "@/lib/google/store";

/* POST {siteId, property, product?}: links a saved site to one of the connected account's Search Console properties
   (product "gsc", the default) or GA4 properties ("ga4"), checked against Google's own list, so nobody can link a
   property they can't read. */

const no = (error: string, status: number) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  if (!(await canUseGoogle(user.id))) return no("Google data comes with the Professional and Business plans.", 402);
  const body = (await req.json().catch(() => ({}))) as { siteId?: unknown; property?: unknown; product?: unknown };
  if (typeof body.siteId !== "string" || typeof body.property !== "string") return no("Pick a property.", 400);
  const site = await ownSite(body.siteId, user.id);
  if (!site) return no("Site not found.", 404);
  const conn = await getConnection(user.id);
  if (!conn) return no("Connect Google first.", 409);
  const access = await accessFor(conn);
  if (!access) return no("Google access was removed. Connect Google again.", 409);
  if (body.product === "ga4") {
    const hit = (await listGa4Properties(access)).find((p) => p.property === body.property);
    if (!hit) return no("This Google account can't read that Analytics property.", 403);
    await setGa4Property(site.id, user.id, hit.property, hit.name);
  } else {
    const props = await listProperties(access);
    if (!props.some((p) => p.siteUrl === body.property)) return no("This Google account can't read that property.", 403);
    await setGscProperty(site.id, user.id, body.property);
  }
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
