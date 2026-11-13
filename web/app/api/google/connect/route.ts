import { userFromRequest } from "@/lib/auth";
import { makeState, pkceChallenge } from "@/lib/google/crypto";
import { authUrl, googleOn, redirectUri } from "@/lib/google/oauth";
import { canUseGoogle, getConnection, ownSite } from "@/lib/google/store";
import { rateLimit } from "@/lib/scan/store";

/* Starts Connect Google for one saved site. The browser sends its bearer token here and gets back Google's consent
   URL; the signed `state` carries who asked and where to return, so the callback needs no cookie. */

const no = (error: string, status: number) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return no("Please sign in first.", 401);
  if (!googleOn()) return no("Google isn't set up on this server yet.", 503);
  if (!(await canUseGoogle(user.id))) return no("Google data comes with the Professional and Business plans.", 402);
  const body = (await req.json().catch(() => ({}))) as { siteId?: unknown; scanId?: unknown };
  if (typeof body.siteId !== "string" || typeof body.scanId !== "string" || !/^[A-Za-z0-9_-]{6,32}$/.test(body.scanId)) return no("Open a saved site's report first.", 400);
  if (!(await ownSite(body.siteId, user.id))) return no("Save this site to your account first.", 404);
  if (!(await rateLimit(`gconnect:${user.id}`, 10, 3600))) return no("Too many attempts. Try again in an hour.", 429);

  const { state, verifier } = await makeState({ u: user.id, s: body.siteId, r: body.scanId, p: "gsc" });
  const conn = await getConnection(user.id);
  const url = authUrl({ product: "gsc", state, challenge: await pkceChallenge(verifier), redirect: redirectUri(new URL(req.url).origin), hint: conn?.google_email ?? user.email });
  return Response.json({ url }, { headers: { "cache-control": "no-store" } });
}
