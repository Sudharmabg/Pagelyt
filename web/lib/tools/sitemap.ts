import { safeFetch } from "@/lib/scan/fetcher";
import { inspect, sitemapLocs } from "@/lib/scan/crawl";
import { openForHtml, withBrowser } from "@/lib/pdf";

/* Sitemap generator (and "load from sitemap" in the bulk schema checker).
   The browser drives the crawl: it asks for the site's existing sitemap once, then sends batches of pages to
   crawlPages and queues the links that come back. Only pages that should be indexed go into the new sitemap. */

import { existingSitemap } from "@/lib/scan/sitemap-existing";
export { existingSitemap };
const bare = (h: string) => h.replace(/^www\./, "").toLowerCase();

export type CrawledPage = {
  url: string;
  status: number;
  /** Whether it belongs in the sitemap, and if not, why. */
  include: boolean;
  reason?: "redirect" | "error" | "noindex" | "canonical" | "not-html";
  /** Where a redirect or a canonical points, when it is on the same site (queued for crawling). */
  target?: string;
  lastmod?: string;
};

const norm = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "");

const sameSiteOf = (site: string) => (u: string) => {
  try {
    const x = new URL(u);
    return /^https?:$/.test(x.protocol) && bare(x.hostname) === site ? x.href.replace(/#.*$/, "") : null;
  } catch {
    return null;
  }
};

/** The verdict for one fetched (or rendered) HTML page, adding the links it found to `links`. */
function judge(url: string, status: number, headers: Record<string, unknown>, body: string, site: string, links: Set<string>): CrawledPage {
  const sameSite = sameSiteOf(site);
  if (status >= 400) return { url, status, include: false, reason: "error" };
  if (!/html/i.test(String(headers["content-type"] ?? "html"))) return { url, status, include: false, reason: "not-html" };
  const { page, links: found } = inspect(url, status, body, site);
  for (const l of found) links.add(l);
  const xRobots = String(headers["x-robots-tag"] ?? "").toLowerCase();
  const modified = Date.parse(String(headers["last-modified"] ?? ""));
  const lastmod = Number.isFinite(modified) ? new Date(modified).toISOString().slice(0, 10) : undefined;
  if (page.noindex || /noindex/.test(xRobots)) return { url, status, include: false, reason: "noindex" };
  if (page.canonicalUrl && norm(page.canonicalUrl) !== norm(url)) {
    const c = sameSite(page.canonicalUrl);
    if (c) links.add(c);
    return { url, status, include: false, reason: "canonical", ...(c ? { target: c } : {}) };
  }
  return { url, status, include: true, ...(lastmod ? { lastmod } : {}) };
}

/** Fetch one batch of pages (no redirects followed). Returns each page's verdict and the internal links found. */
export async function crawlPages(urls: string[], host: string): Promise<{ pages: CrawledPage[]; links: string[] }> {
  const site = bare(host);
  const sameSite = sameSiteOf(site);
  const pages: CrawledPage[] = [];
  const links = new Set<string>();
  const blocked = new Set<string>();
  const one = async (url: string) => {
    try {
      const r = await safeFetch(new URL(url), { follow: false });
      if (r.status >= 300 && r.status < 400) {
        const loc = typeof r.headers.location === "string" ? sameSite(new URL(r.headers.location, url).href) : null;
        if (loc) links.add(loc);
        pages.push({ url, status: r.status, include: false, reason: "redirect", ...(loc ? { target: loc } : {}) });
        return;
      }
      pages.push(judge(url, r.status, r.headers, r.body, site, links));
    } catch (e) {
      if (/Blocked/.test(e instanceof Error ? e.message : "")) blocked.add(url);
      else pages.push({ url, status: 0, include: false, reason: "error" });
    }
  };
  // A slow page shouldn't hold up the batch: after 12 s, pages still loading are reported as errors.
  await Promise.race([Promise.all(urls.map(one)), new Promise((r) => setTimeout(r, 12_000))]);
  const answered = new Set(pages.map((p) => p.url));
  for (const url of urls) if (!answered.has(url) && !blocked.has(url)) pages.push({ url, status: 0, include: false, reason: "error" });
  return { pages, links: [...links].slice(0, 1000) };
}

/** The same, but each page is loaded in a real browser (Cloudflare Browser Rendering) so links that JavaScript
    adds are found. For sites whose raw HTML has no links. Images, fonts, CSS and trackers are skipped. Each address is
    checked with safeFetch first, so only public addresses are ever opened. Throws NoBrowser where rendering is off. */
export async function renderPages(urls: string[], host: string): Promise<{ pages: CrawledPage[]; links: string[] }> {
  const site = bare(host);
  const sameSite = sameSiteOf(site);
  const pages: CrawledPage[] = [];
  const links = new Set<string>();
  const ok: string[] = [];
  for (const url of urls) {
    try {
      const r = await safeFetch(new URL(url), { follow: false }); // also refuses private addresses
      if (r.status >= 300 && r.status < 400) {
        const loc = typeof r.headers.location === "string" ? sameSite(new URL(r.headers.location, url).href) : null;
        if (loc) links.add(loc);
        pages.push({ url, status: r.status, include: false, reason: "redirect", ...(loc ? { target: loc } : {}) });
      } else if (r.status >= 400 || !/html/i.test(String(r.headers["content-type"] ?? "html"))) {
        pages.push(judge(url, r.status, r.headers, r.body, site, links));
      } else ok.push(url);
    } catch (e) {
      if (!/Blocked/.test(e instanceof Error ? e.message : "")) pages.push({ url, status: 0, include: false, reason: "error" });
    }
  }
  if (!ok.length) return { pages, links: [...links] };
  await withBrowser(async (browser) => {
    for (const url of ok) {
      try {
        const { page, res } = await openForHtml(browser, url, 8_000, 1_500);
        const status = res?.status() ?? 200;
        const headers = (res?.headers() ?? {}) as Record<string, unknown>;
        pages.push(judge(url, status, headers, await page.content(), site, links));
        await page.close().catch(() => {});
      } catch {
        pages.push({ url, status: 0, include: false, reason: "error" });
      }
    }
  });
  return { pages, links: [...links].slice(0, 1000) };
}
