import type { CrawlSummary } from "./types";
import { SITEMAP } from "../tools/limits";

/* Why a scan crawled the pages it did, and what would let it find more. Runs in the browser, so no cheerio here.
   Newer scans carry `crawl.stop` with the exact numbers; older ones get a best guess from what they have. */

/** Pages crawled per scan (crawl.ts imports this). */
export const CRAWL_LIMIT = 30;
/** Seconds each crawl batch waits for slow pages. */
export const CRAWL_WAIT_S = 12;

export type CrawlFix = { text: string; tool?: "sitemap-generator" | "raw-vs-rendered-html" | "robots-txt-tester" };
export type CrawlWhy = {
  crawled: number;
  /** Pages we know exist (crawled + known but not visited), when the scan recorded it. */
  known: number | null;
  /** Short reasons, most important first. */
  reasons: string[];
  fixes: CrawlFix[];
  /** "full": we crawled everything we found. "capped": the page limit stopped us. "thin": we couldn't find pages. */
  kind: "full" | "capped" | "thin";
  exact: boolean;
};

const n = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

export function crawlWhy(crawl: CrawlSummary | null | undefined, opts: { noSitemap: boolean }): CrawlWhy {
  const crawled = crawl?.pages ?? 1;
  const s = crawl?.stop;
  const limit = s?.limit ?? CRAWL_LIMIT;
  const reasons: string[] = [];
  const fixes: CrawlFix[] = [];
  const capped = crawled >= limit;

  if (s) {
    const unvisited = Math.max(s.found + 1 - crawled - s.missed, s.linked - s.missed, 0);
    const known = crawled + s.missed + unvisited;
    if (capped) {
      reasons.push(`We stop at ${limit} pages per scan, and ${unvisited ? `we know of at least ${n(unvisited, "more page")}` : "your site has more"}.`);
      fixes.push({ text: `Pages past the first ${limit} aren't checked in this report. The Sitemap generator crawls up to ${SITEMAP.free} pages (${SITEMAP.paid.toLocaleString("en-GB")} on paid plans) to find the rest.`, tool: "sitemap-generator" });
    }
    if (s.missed) {
      reasons.push(`${n(s.missed, "page")} didn't answer within ${CRAWL_WAIT_S} seconds, so we left ${s.missed === 1 ? "it" : "them"} out.`);
      fixes.push({ text: "Check that slow pages load quickly (caching, a faster host or a CDN), then rescan." });
    }
    if (s.sitemap === "none") {
      reasons.push("There is no sitemap at /sitemap.xml, so we could only follow links.");
      fixes.push({ text: "Add a sitemap at /sitemap.xml listing every page, and point to it from robots.txt.", tool: "sitemap-generator" });
    } else if (s.sitemap === "index") {
      reasons.push("Your /sitemap.xml is an index that points to other sitemaps. This scan reads only a plain list of pages.");
      fixes.push({ text: "Publish one sitemap at /sitemap.xml that lists your pages directly (it can sit beside the index).", tool: "sitemap-generator" });
    }
    if (s.homeLinks === 0) {
      reasons.push("Your homepage's HTML has no links to other pages on the same site. Either the site really is one page, or its menu is built with JavaScript: links that appear only after scripts run can't be followed.");
      fixes.push({ text: "Make menu and footer links plain <a href> links in the page's HTML (server-side rendering does this), or rely on a sitemap.", tool: "raw-vs-rendered-html" });
    } else if (s.homeLinks < 5 && !capped) {
      reasons.push(`Your homepage links to only ${n(s.homeLinks, "other page")} on the same site.`);
      fixes.push({ text: "Link to your main pages (services, products, about, contact, blog) from the homepage menu or footer." });
    }
    if (!reasons.length) reasons.push(`That's every page we could find: your ${s.sitemap === "list" ? "sitemap and " : ""}links don't point anywhere else on the site.`);
    if (!fixes.length && crawled < 3) fixes.push({ text: "If your site has more pages, link to them from the homepage and list them in your sitemap." });
    return { crawled, known: Math.max(known, crawled), reasons, fixes, kind: capped ? "capped" : crawled < 3 && (s.homeLinks < 5 || s.sitemap !== "list") ? "thin" : "full", exact: true };
  }

  // Older reports: a best guess from the totals.
  if (capped) {
    reasons.push(`We stop at ${limit} pages per scan${crawl?.sitemapUrls && crawl.sitemapUrls > crawled ? `, and your sitemap lists ${crawl.sitemapUrls}` : ""}.`);
    fixes.push({ text: `Pages past the first ${limit} aren't checked in this report. The Sitemap generator crawls further to find the rest.`, tool: "sitemap-generator" });
  }
  if (opts.noSitemap) {
    reasons.push("We couldn't find a sitemap, so we could only follow links from the homepage.");
    fixes.push({ text: "Add a sitemap at /sitemap.xml listing every page, and point to it from robots.txt.", tool: "sitemap-generator" });
  }
  if (crawled < 3) {
    reasons.push("Few or no links on the homepage led to other pages. On sites built with JavaScript, links that appear only after scripts run can't be followed.");
    fixes.push({ text: "Link to your main pages with plain <a href> links in the homepage's HTML, or list them in a sitemap.", tool: "raw-vs-rendered-html" });
  }
  if (!reasons.length) reasons.push("That looks like every page we could reach from your sitemap and links.");
  fixes.push({ text: "Rescan to get the exact reason: newer scans record why the crawl stopped." });
  return { crawled, known: crawl?.sitemapUrls && crawl.sitemapUrls > crawled ? crawl.sitemapUrls : null, reasons, fixes, kind: capped ? "capped" : crawled < 3 ? "thin" : "full", exact: false };
}
