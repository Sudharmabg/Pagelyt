import * as cheerio from "cheerio";
import { safeFetch } from "./fetcher";
import type { Finding, CrawlSummary, CrawlPage, PageTable } from "./types";
import { crawlDeepFindings, hreflangs, pageSchemaProblems } from "./seo-deep";

/* Multi-page crawl. Two stages of PER_STAGE pages each (one subrequest per page), so a scan covers
   up to MAX_PAGES pages of the same site. Pages come from the sitemap first, then internal links. */

export const MAX_PAGES = 30;
export const PER_STAGE = 15;
const DEADLINE_MS = 12_000;
const THIN_WORDS = 150;

const SKIP_EXT = /\.(?:jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|gz|mp4|mp3|webm|css|js|json|xml|txt|woff2?|ttf)(?:$|\?)/i;

const clean = (u: URL) => {
  u.hash = "";
  return u.href;
};

/** `<loc>` entries of a sitemap (sitemap indexes are skipped; only page URLs are kept). */
export function sitemapLocs(xml: string, host: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    try {
      const u = new URL(m[1].replace(/&amp;/g, "&"));
      if (/^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, "") === host && !SKIP_EXT.test(u.pathname)) out.push(clean(u));
    } catch {
      /* ignore bad entry */
    }
    if (out.length >= 500) break;
  }
  return out;
}

export function internalLinks(html: string, base: string, host: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(href)) return;
    try {
      const u = new URL(href, base);
      if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, "") !== host || SKIP_EXT.test(u.pathname)) return;
      seen.add(clean(u));
    } catch {
      /* malformed */
    }
  });
  return [...seen];
}

/** Pages to crawl: the homepage, then sitemap URLs, then homepage links, deduplicated. */
export function crawlQueue(home: string, host: string, sitemap: string[], homeLinks: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>([home, home.replace(/\/$/, "")]);
  for (const u of [...sitemap, ...homeLinks]) {
    const key = u.replace(/\/$/, "");
    if (seen.has(u) || seen.has(key)) continue;
    seen.add(u);
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_PAGES - 1) break;
  }
  return out;
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function inspect(url: string, status: number, html: string, host: string): { page: CrawlPage; links: string[] } {
  const $ = cheerio.load(html.slice(0, 400_000));
  const robots = ($('meta[name="robots"]').attr("content") || "").toLowerCase();
  const ld = pageSchemaProblems($); // before scripts are stripped
  const { alts } = hreflangs($, url);
  let canonicalUrl: string | undefined;
  try {
    const c = $('link[rel="canonical"]').attr("href");
    if (c) canonicalUrl = new URL(c, url).href;
  } catch {
    /* malformed canonical */
  }
  $("script,style,noscript,svg").remove();
  const title = $("title").first().text().trim().replace(/\s+/g, " ");
  return {
    page: {
      url,
      status,
      title,
      description: ($('meta[name="description"]').attr("content") || "").trim().replace(/\s+/g, " ").slice(0, 300),
      h1: $("h1").length,
      canonical: !!$('link[rel="canonical"]').attr("href"),
      noindex: /noindex/.test(robots),
      words: words($("body").text()),
      ...(canonicalUrl ? { canonicalUrl } : {}),
      ...(alts.length ? { alts: alts.slice(0, 20) } : {}),
      ...(ld.length ? { ld } : {}),
    },
    links: status < 400 ? internalLinks(html, url, host) : [],
  };
}

/** Fetch one batch of pages in parallel; whatever finished by the deadline is kept. */
export async function crawlBatch(urls: string[], host: string): Promise<{ pages: CrawlPage[]; linked: string[] }> {
  const pages: CrawlPage[] = [];
  const linked = new Set<string>();
  const one = async (url: string) => {
    try {
      const r = await safeFetch(new URL(url), { follow: false });
      const isHtml = /html/i.test(String(r.headers["content-type"] ?? "html"));
      if (r.status >= 300 && r.status < 400) {
        pages.push({ url, status: r.status, title: "", description: "", h1: 0, canonical: false, noindex: false, words: 0 });
        return;
      }
      const { page, links } = isHtml && r.status < 400 ? inspect(url, r.status, r.body, host) : { page: { url, status: r.status, title: "", description: "", h1: 0, canonical: false, noindex: false, words: 0 }, links: [] };
      pages.push(page);
      for (const l of links) linked.add(l);
    } catch (e) {
      // Unreachable counts as broken; our own SSRF refusals and timeouts are not the site's fault.
      if (!/Blocked|timed out/i.test(e instanceof Error ? e.message : "")) {
        pages.push({ url, status: 0, title: "", description: "", h1: 0, canonical: false, noindex: false, words: 0 });
      }
    }
  };
  await Promise.race([Promise.all(urls.map(one)), new Promise((r) => setTimeout(r, DEADLINE_MS))]);
  return { pages, linked: [...linked].slice(0, 600) };
}

const ex = (list: string[], n = 5) => list.slice(0, n).join(" · ") + (list.length > n ? ` · +${list.length - n} more` : "");
const path = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search || "/";
  } catch {
    return u;
  }
};

export function crawlSummary(pages: CrawlPage[], sitemapCount: number): CrawlSummary {
  return { pages: pages.length, sitemapUrls: sitemapCount, broken: pages.filter((p) => p.status === 0 || p.status >= 400).length, list: pages.slice(0, MAX_PAGES) };
}

export function crawlFindings(pages: CrawlPage[], opts: { sitemap: string[]; linked: string[]; home: string }): Finding[] {
  const out: Finding[] = [];
  if (pages.length < 2) return out;
  const ok = pages.filter((p) => p.status >= 200 && p.status < 300);
  const add = (module: Finding["module"], severity: Finding["severity"], id: string, title: string, why: string, fix: string, evidence?: string, pages?: PageTable) =>
    out.push({ id, module, severity, title, why, fix, evidence, ...(pages ? { pages } : {}) });
  const only = (list: CrawlPage[]): PageTable => ({ cols: [], rows: list.map((p) => ({ url: p.url, cells: [] })) });

  const broken = pages.filter((p) => p.status === 0 || p.status >= 400);
  if (broken.length) {
    add("health", broken.length > 2 ? "high" : "medium", "crawl-broken-pages", `${broken.length} page${broken.length > 1 ? "s" : ""} on your site return errors`, "These pages are linked from your site or listed in your sitemap but cannot be loaded. Visitors and search engines hit dead ends.", "Restore each page, redirect it to a working one, or remove it from your links and sitemap.", ex(broken.map((p) => `${p.status || "no response"} ${path(p.url)}`)), { cols: ["Status"], rows: broken.map((p) => ({ url: p.url, cells: [p.status ? String(p.status) : "No response"] })) });
  }

  const dupBy = (key: (p: CrawlPage) => string) => {
    const groups = new Map<string, CrawlPage[]>();
    for (const p of ok) {
      const k = key(p).toLowerCase();
      if (k) groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  };
  const dupT = dupBy((p) => p.title);
  if (dupT.length) {
    const n = dupT.reduce((a, g) => a + g.length, 0);
    add("seo", dupT.length > 2 ? "medium" : "low", "crawl-duplicate-titles", `${n} pages share a duplicate title`, "When pages share a title, search engines struggle to tell them apart and may pick the wrong one to show.", "Give every page a unique title that describes that page.", ex(dupT.map((g) => `“${g[0].title.slice(0, 50)}” on ${g.map((p) => path(p.url)).slice(0, 3).join(", ")}`), 3), { cols: ["Shared title"], rows: dupT.flatMap((g) => g.map((p) => ({ url: p.url, cells: [p.title.slice(0, 120)] }))) });
  }
  const dupD = dupBy((p) => p.description);
  if (dupD.length) {
    const n = dupD.reduce((a, g) => a + g.length, 0);
    add("seo", "low", "crawl-duplicate-descriptions", `${n} pages share a duplicate meta description`, "Identical descriptions give searchers no reason to choose one page over another.", "Write a unique description for each page.", ex(dupD.map((g) => g.map((p) => path(p.url)).slice(0, 3).join(", ")), 3), { cols: ["Shared description"], rows: dupD.flatMap((g) => g.map((p) => ({ url: p.url, cells: [p.description.length > 120 ? `${p.description.slice(0, 117)}…` : p.description] }))) });
  }

  const noTitle = ok.filter((p) => !p.title);
  if (noTitle.length) add("seo", "medium", "crawl-missing-titles", `${noTitle.length} page${noTitle.length > 1 ? "s" : ""} have no title`, "The title is the headline in search results and the strongest on-page signal.", "Add a descriptive <title> to each page.", ex(noTitle.map((p) => path(p.url))), only(noTitle));
  const noDesc = ok.filter((p) => !p.description && !p.noindex);
  if (noDesc.length) add("seo", "low", "crawl-missing-descriptions", `${noDesc.length} page${noDesc.length > 1 ? "s" : ""} have no meta description`, "Without one, search engines make up a snippet, often a poor one.", "Add a 120–160 character description to each page.", ex(noDesc.map((p) => path(p.url))), only(noDesc));
  const noCanon = ok.filter((p) => !p.canonical && !p.noindex);
  if (noCanon.length > 1) add("seo", "low", "crawl-missing-canonicals", `${noCanon.length} pages have no canonical tag`, "A canonical tag tells search engines which URL is the main version, which prevents duplicate-content splits.", "Add <link rel=\"canonical\"> to each page.", ex(noCanon.map((p) => path(p.url))), only(noCanon));
  const noH1 = ok.filter((p) => p.h1 === 0 && !p.noindex);
  if (noH1.length) add("seo", "low", "crawl-missing-h1", `${noH1.length} page${noH1.length > 1 ? "s" : ""} have no H1 heading`, "The H1 states what the page is about for visitors, search engines and AI assistants.", "Add one clear H1 per page.", ex(noH1.map((p) => path(p.url))), only(noH1));
  const thin = ok.filter((p) => p.words < THIN_WORDS && !p.noindex);
  if (thin.length) add("seo", "low", "crawl-thin-content", `${thin.length} page${thin.length > 1 ? "s" : ""} have very little text`, `Pages under about ${THIN_WORDS} words rarely rank and give AI assistants little to quote.`, "Expand these pages with useful detail, or merge or remove them.", ex(thin.map((p) => `${path(p.url)} (${p.words} words)`)), { cols: ["Words"], rows: thin.map((p) => ({ url: p.url, cells: [String(p.words)] })) });

  const inMap = new Set(opts.sitemap.map((u) => u.replace(/\/$/, "")));
  const noindexMap = pages.filter((p) => p.noindex && inMap.has(p.url.replace(/\/$/, "")));
  if (noindexMap.length) add("seo", "medium", "crawl-noindex-in-sitemap", `${noindexMap.length} page${noindexMap.length > 1 ? "s" : ""} in your sitemap are set to noindex`, "The sitemap asks search engines to index pages that are also telling them not to. That is a mixed signal.", "Remove these pages from the sitemap, or remove the noindex.", ex(noindexMap.map((p) => path(p.url))), only(noindexMap));

  // Orphans can only be judged when the whole sitemap was crawled.
  if (opts.sitemap.length > 0 && opts.sitemap.length <= MAX_PAGES) {
    const linked = new Set([...opts.linked, opts.home].map((u) => u.replace(/\/$/, "")));
    const orphans = opts.sitemap.filter((u) => !linked.has(u.replace(/\/$/, "")));
    if (orphans.length) add("seo", "low", "crawl-orphan-pages", `${orphans.length} sitemap page${orphans.length > 1 ? "s are" : " is"} not linked from anywhere`, "Pages with no internal links are hard for visitors and search engines to find, and receive no link authority.", "Link to these pages from related pages or your navigation.", ex(orphans.map(path)), { cols: [], rows: orphans.map((u) => ({ url: u, cells: [] })) });
  }
  out.push(...crawlDeepFindings(pages));
  return out;
}
