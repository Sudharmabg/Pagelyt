import { safeFetch } from "@/lib/scan/fetcher";
import { inspect, sitemapLocs } from "@/lib/scan/crawl";

/* Sitemap generator (and "load from sitemap" in the bulk schema checker).
   The browser drives the crawl: it asks for the site's existing sitemap once, then sends batches of pages to
   crawlPages and queues the links that come back. Only pages that should be indexed go into the new sitemap. */

const bare = (h: string) => h.replace(/^www\./, "").toLowerCase();
const MAX_CHILD_SITEMAPS = 5;

/** URLs listed in the site's current sitemaps (robots.txt Sitemap lines, then /sitemap.xml), indexes followed one level. */
export async function existingSitemap(origin: string, max: number): Promise<{ sitemaps: string[]; urls: string[] }> {
  const host = bare(new URL(origin).hostname);
  const found: string[] = [];
  try {
    const r = await safeFetch(new URL("/robots.txt", origin), { accept: "text/plain,*/*;q=0.5" });
    if (r.status === 200) for (const m of r.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)) found.push(m[1]);
  } catch {
    /* no robots.txt */
  }
  if (!found.length) found.push(new URL("/sitemap.xml", origin).href, new URL("/sitemap_index.xml", origin).href);

  const used: string[] = [];
  const urls = new Set<string>();
  const queue = [...new Set(found)].slice(0, 3);
  let children = 0;
  while (queue.length && urls.size < max) {
    const at = queue.shift()!;
    let u: URL;
    try {
      u = new URL(at);
    } catch {
      continue;
    }
    if (bare(u.hostname) !== host) continue;
    try {
      const r = await safeFetch(u, { accept: "application/xml,text/xml,*/*;q=0.5" });
      if (r.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(r.body)) continue;
      used.push(u.href);
      if (/<sitemapindex\b/i.test(r.body)) {
        for (const m of r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
          if (children++ >= MAX_CHILD_SITEMAPS) break;
          queue.push(m[1].replace(/&amp;/g, "&"));
        }
      } else {
        for (const p of sitemapLocs(r.body, host)) {
          urls.add(p);
          if (urls.size >= max) break;
        }
      }
    } catch {
      /* unreachable sitemap */
    }
  }
  return { sitemaps: used, urls: [...urls] };
}

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

/** Fetch one batch of pages (no redirects followed). Returns each page's verdict and the internal links found. */
export async function crawlPages(urls: string[], host: string): Promise<{ pages: CrawledPage[]; links: string[] }> {
  const site = bare(host);
  const pages: CrawledPage[] = [];
  const links = new Set<string>();
  const sameSite = (u: string) => {
    try {
      const x = new URL(u);
      return /^https?:$/.test(x.protocol) && bare(x.hostname) === site ? x.href.replace(/#.*$/, "") : null;
    } catch {
      return null;
    }
  };
  const one = async (url: string) => {
    try {
      const r = await safeFetch(new URL(url), { follow: false });
      if (r.status >= 300 && r.status < 400) {
        const loc = typeof r.headers.location === "string" ? sameSite(new URL(r.headers.location, url).href) : null;
        if (loc) links.add(loc);
        pages.push({ url, status: r.status, include: false, reason: "redirect", ...(loc ? { target: loc } : {}) });
        return;
      }
      if (r.status >= 400) return void pages.push({ url, status: r.status, include: false, reason: "error" });
      if (!/html/i.test(String(r.headers["content-type"] ?? "html"))) return void pages.push({ url, status: r.status, include: false, reason: "not-html" });
      const { page, links: found } = inspect(url, r.status, r.body, site);
      for (const l of found) links.add(l);
      const xRobots = String(r.headers["x-robots-tag"] ?? "").toLowerCase();
      const modified = Date.parse(String(r.headers["last-modified"] ?? ""));
      const lastmod = Number.isFinite(modified) ? new Date(modified).toISOString().slice(0, 10) : undefined;
      if (page.noindex || /noindex/.test(xRobots)) return void pages.push({ url, status: r.status, include: false, reason: "noindex" });
      if (page.canonicalUrl && norm(page.canonicalUrl) !== norm(url)) {
        const c = sameSite(page.canonicalUrl);
        if (c) links.add(c);
        return void pages.push({ url, status: r.status, include: false, reason: "canonical", ...(c ? { target: c } : {}) });
      }
      pages.push({ url, status: r.status, include: true, ...(lastmod ? { lastmod } : {}) });
    } catch (e) {
      if (!/Blocked/.test(e instanceof Error ? e.message : "")) pages.push({ url, status: 0, include: false, reason: "error" });
    }
  };
  await Promise.race([Promise.all(urls.map(one)), new Promise((r) => setTimeout(r, 20_000))]);
  return { pages, links: [...links].slice(0, 1000) };
}
