import { safeFetch } from "./fetcher";
import { sitemapLocs } from "./crawl";

/* The URLs a site already lists in its sitemaps. Shared by the sitemap generator and the Search Console indexing check. */

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
