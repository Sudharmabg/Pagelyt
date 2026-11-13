import { readState } from "@/lib/google/crypto";
import { exchangeCode, googleOn, redirectUri, SCOPES } from "@/lib/google/oauth";
import { listProperties, matchProperty } from "@/lib/google/gsc";
import { listGa4Properties, matchGa4Property } from "@/lib/google/ga4";
import { canUseGoogle, getLink, ownSite, saveConnection, setGa4Property, setGscProperty } from "@/lib/google/store";

/* Google sends the person back here after the consent screen. The signed state says which account, site and product
   (Search Console or Analytics) asked; the code is swapped for tokens (PKCE), the refresh token is stored encrypted,
   and the site is matched to its Search Console or GA4 property when there is an obvious one. Then back to the
   report's Google data view, on the right tab. */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const st = await readState(url.searchParams.get("state") ?? "").catch(() => null);
  const ga = st?.p === "ga4";
  const back = (status: string) => Response.redirect(new URL(st ? `/dashboard/${encodeURIComponent(st.r)}?view=google${ga ? "&gtab=analytics" : ""}&google=${ga ? "ga4" : ""}${status}` : `/account?google=${status}`, url.origin), 302);
  if (!st) return back("expired");
  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code || !googleOn()) return back("failed");
  if (!(await canUseGoogle(st.u))) return back("plan");
  const site = await ownSite(st.s, st.u);
  if (!site) return back("failed");

  try {
    const g = await exchangeCode(code, st.verifier, redirectUri(url.origin));
    // Google's consent screen lets people untick a permission; without it there is nothing to read.
    if (!g.scopes.includes(SCOPES[st.p])) return back("scope");
    await saveConnection(st.u, g);
    const link = await getLink(site.id);
    if (ga) {
      if (!link?.ga4_property) {
        const props = await listGa4Properties(g.access);
        const match = await matchGa4Property(g.access, site.host, props);
        if (match) await setGa4Property(site.id, st.u, match, props.find((p) => p.property === match)?.name ?? null);
        else return back(props.length ? "pick" : "noproperty");
      }
    } else if (!link?.gsc_property) {
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
