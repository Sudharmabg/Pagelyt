import { clientIp, userFromRequest } from "@/lib/auth";
import { reply } from "@/lib/gotrue";
import { NoBrowser } from "@/lib/pdf";
import { guard, LIMITS } from "@/lib/ratelimit";
import { isPaid } from "@/lib/scan/agency";
import { normaliseUrl, safeFetch } from "@/lib/scan/fetcher";
import { live } from "@/lib/scan/store";
import { checkAiBots } from "@/lib/tools/ai-bots";
import { checkSchemaPage } from "@/lib/tools/bulk-schema";
import { cleanDomain, domainAge } from "@/lib/tools/domain-age";
import { checkHreflang } from "@/lib/tools/hreflang";
import { BULK_SCHEMA, SITEMAP } from "@/lib/tools/limits";
import { compareRendered } from "@/lib/tools/rendered-live";
import { crawlPages, existingSitemap } from "@/lib/tools/sitemap";

/* The free tools that need our server to fetch another site. Signed-in visitors only (open in local development
   without Supabase), rate-limited per account and per IP. Body: { tool, url?, urls?, domains?, host? }.
   The bulk tools are driven by the browser in batches (see lib/tools/limits.ts); "plan" tells it its limits. */

const MAX_DOMAINS = 10;
const BATCHED = new Set(["schema-bulk", "sitemap-crawl"]);

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user && live()) return reply({ error: "Please sign in to use this tool.", code: "signed_out" }, 401);

  let body: { tool?: unknown; url?: unknown; urls?: unknown; domains?: unknown; host?: unknown; for?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Bad request." }, 400);
  }
  const tool = String(body.tool ?? "");
  // Without Supabase (local development) everyone counts as paid, like the rest of the paid features there.
  const paid = async () => (user ? await isPaid(user.id).catch(() => false) : true);
  if (tool === "plan") {
    const p = await paid();
    return reply({ paid: p, schema: p ? BULK_SCHEMA.paid : BULK_SCHEMA.free, sitemap: p ? SITEMAP.paid : SITEMAP.free });
  }

  const ip = clientIp(req);
  const who = user?.id ?? "anon";
  const limited = await guard(tool === "rendered" ? LIMITS.render(ip, who) : BATCHED.has(tool) ? LIMITS.toolBatch(ip, who) : LIMITS.tool(ip, who));
  if (limited) return limited;

  const url = () => {
    const u = normaliseUrl(String(body.url ?? "").slice(0, 2048));
    if (!u) throw new Error("Enter a full public address such as https://example.com");
    return u;
  };
  const list = (max: number) => (Array.isArray(body.urls) ? body.urls : []).map((x) => String(x).slice(0, 2048)).filter(Boolean).slice(0, max);

  try {
    switch (tool) {
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
      case "sitemap-urls": {
        // The site's current sitemap: the starting queue for the generator, or the URL list for bulk schema.
        const u = url();
        const p = await paid();
        const lim = body.for === "schema" ? BULK_SCHEMA : SITEMAP;
        const max = p ? lim.paid : lim.free;
        const found = await existingSitemap(u.origin, max);
        return reply({ home: u.origin + "/", host: u.hostname, ...found });
      }
      case "schema-bulk": {
        const urls = list(BULK_SCHEMA.batch);
        if (!urls.length) return reply({ error: "Enter at least one page address." }, 400);
        return reply({ pages: await Promise.all(urls.map(checkSchemaPage)) });
      }
      case "sitemap-crawl": {
        // Every page in a batch must be on the site being crawled.
        const host = String(body.host ?? "").toLowerCase().replace(/^www\./, "");
        const urls = list(SITEMAP.batch).filter((x) => normaliseUrl(x)?.hostname.toLowerCase().replace(/^www\./, "") === host);
        if (!host || !urls.length) return reply({ error: "Nothing to crawl." }, 400);
        return reply(await crawlPages(urls, host));
      }
      case "rendered": {
        if (!(await paid())) return reply({ error: "Raw vs rendered HTML comes with any paid plan.", upgrade: true }, 403);
        return reply({ report: await compareRendered(url()) });
      }
      default:
        return reply({ error: "Unknown tool." }, 400);
    }
  } catch (e) {
    if (e instanceof NoBrowser) return reply({ error: "Page rendering isn't switched on here yet. Please try again later." }, 503);
    const msg = e instanceof Error ? e.message : "";
    const friendly = /Enter a full|Blocked/.test(msg) ? msg.replace(/^Blocked.*$/, "That address isn't publicly reachable.") : /timed out|Navigation timeout/i.test(msg) ? "The site took too long to answer." : /Not an HTML/.test(msg) ? "That address isn't an HTML page." : "We couldn't reach that site.";
    return reply({ error: friendly }, 422);
  }
}
