import { clientIp, userFromRequest } from "@/lib/auth";
import { reply } from "@/lib/gotrue";
import { guard, LIMITS } from "@/lib/ratelimit";
import { normaliseUrl, safeFetch } from "@/lib/scan/fetcher";
import { live } from "@/lib/scan/store";
import { checkAiBots } from "@/lib/tools/ai-bots";
import { cleanDomain, domainAge } from "@/lib/tools/domain-age";
import { checkHreflang } from "@/lib/tools/hreflang";

/* The free tools that need our server to fetch another site. Signed-in visitors only (open in local development
   without Supabase), rate-limited per account and per IP. Body: { tool, url? , domains? }. */

const MAX_DOMAINS = 10;

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user && live()) return reply({ error: "Please sign in to use this tool.", code: "signed_out" }, 401);

  const limited = await guard(LIMITS.tool(clientIp(req), user?.id ?? "anon"));
  if (limited) return limited;

  let body: { tool?: unknown; url?: unknown; domains?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Bad request." }, 400);
  }

  const url = () => {
    const u = normaliseUrl(String(body.url ?? "").slice(0, 2048));
    if (!u) throw new Error("Enter a full public address such as https://example.com");
    return u;
  };

  try {
    switch (body.tool) {
      case "ai-bots":
        return reply({ report: await checkAiBots(url()) });
      case "hreflang":
        return reply({ report: await checkHreflang(url()) });
      case "robots": {
        // Just the file: the tester itself runs in the browser so it can re-test as the visitor edits.
        const u = url();
        const r = await safeFetch(new URL("/robots.txt", u.origin), { accept: "text/plain,*/*;q=0.5" });
        const html = /^\s*<(!doctype|html)/i.test(r.body);
        return reply({ origin: u.origin, status: r.status, text: r.status === 200 && !html ? r.body.slice(0, 500 * 1024) : "", html });
      }
      case "domain-age": {
        const list = (Array.isArray(body.domains) ? body.domains : String(body.domains ?? "").split(/[\s,]+/)).map((d) => String(d)).filter(Boolean);
        const clean = [...new Set(list.map(cleanDomain).filter((d): d is string => !!d))].slice(0, MAX_DOMAINS);
        if (!clean.length) return reply({ error: "Enter at least one domain, such as example.com." }, 400);
        return reply({ results: await Promise.all(clean.map(domainAge)), skipped: Math.max(0, list.length - clean.length) });
      }
      default:
        return reply({ error: "Unknown tool." }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const friendly = /Enter a full|Blocked/.test(msg) ? msg.replace(/^Blocked.*$/, "That address isn't publicly reachable.") : /timed out/i.test(msg) ? "The site took too long to answer." : "We couldn't reach that site.";
    return reply({ error: friendly }, 422);
  }
}
