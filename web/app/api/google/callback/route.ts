import { readState } from "@/lib/google/crypto";
import { exchangeCode, googleOn, redirectUri, SCOPES } from "@/lib/google/oauth";
import { listProperties, matchProperty } from "@/lib/google/gsc";
import { canUseGoogle, getLink, ownSite, saveConnection, setGscProperty } from "@/lib/google/store";

/* Google sends the person back here after the consent screen. The signed state says which account and site asked;
   the code is swapped for tokens (PKCE), the refresh token is stored encrypted, and the site is matched to its
   Search Console property when there is an obvious one. Then back to the report's Google data view. */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const st = await readState(url.searchParams.get("state") ?? "").catch(() => null);
  const back = (status: string) => Response.redirect(new URL(st ? `/dashboard/${encodeURIComponent(st.r)}?view=google&google=${status}` : `/account?google=${status}`, url.origin), 302);
  if (!st) return back("expired");
  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code || !googleOn()) return back("failed");
  if (!(await canUseGoogle(st.u))) return back("plan");
  const site = await ownSite(st.s, st.u);
  if (!site) return back("failed");

  try {
    const g = await exchangeCode(code, st.verifier, redirectUri(url.origin));
    // Google's consent screen lets people untick a permission; without Search Console there is nothing to read.
    if (!g.scopes.includes(SCOPES.gsc)) return back("scope");
    await saveConnection(st.u, g);
    if (!(await getLink(site.id))?.gsc_property) {
      const props = await listProperties(g.access);
      const match = matchProperty(site.host, props);
      if (match) await setGscProperty(site.id, st.u, match);
      else return back(props.length ? "pick" : "noproperty");
    }
    return back("connected");
  } catch (e) {
    console.error("google callback", e instanceof Error ? e.message : e);
    return back("failed");
  }
}
