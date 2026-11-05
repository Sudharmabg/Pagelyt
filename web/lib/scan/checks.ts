import * as cheerio from "cheerio";
import type { FetchResult } from "./fetcher";
import type { Finding, ModuleKey, Severity } from "./types";

export type Ctx = {
  page: FetchResult;
  finalUrl: URL;
  robots: string | null;
  sitemapOk: boolean;
  llmsTxt: boolean;
  httpRedirectsToHttps: boolean | null;
};

type Add = (module: ModuleKey, severity: Severity, id: string, title: string, why: string, fix: string, evidence?: string) => void;

const AI_BOTS = ["GPTBot", "ClaudeBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "CCBot"];

function h(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v.join(", ") : v || "";
}

/** Does robots.txt fully disallow `bot` (or * when no specific group)? */
function robotsBlocks(robots: string, bot: string): boolean {
  const groups: { agents: string[]; rules: string[] }[] = [];
  let cur: { agents: string[]; rules: string[] } | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], rules: [] }));
      cur!.agents.push(m[2].toLowerCase());
      lastWasAgent = true;
    } else if (cur) {
      if (k === "disallow") cur.rules.push(m[2].trim());
      lastWasAgent = false;
    }
  }
  const b = bot.toLowerCase();
  const g = groups.find((x) => x.agents.includes(b));
  return !!g && g.rules.includes("/");
}

export function runChecks(ctx: Ctx): Finding[] {
  const out: Finding[] = [];
  const add: Add = (module, severity, id, title, why, fix, evidence) =>
    out.push({ id, module, severity, title, why, fix, evidence });
  const { page, finalUrl } = ctx;
  const $ = cheerio.load(page.body);
  const isHttps = finalUrl.protocol === "https:";
  const hdr = (n: string) => h(page.headers[n]);

  /* ---------------- Health ---------------- */
  if (page.status >= 500) add("health", "high", "status-5xx", `Server error (HTTP ${page.status})`, "Visitors and search engines cannot load the page.", "Check your server logs and hosting status.");
  else if (page.status >= 400) add("health", "high", "status-4xx", `Page returns HTTP ${page.status}`, "The page cannot be loaded by visitors or search engines.", "Restore the page or redirect it to a working URL.");
  if (page.chain.length > 3) add("health", "medium", "redirect-chain", `Redirect chain of ${page.chain.length - 1} hops`, "Each hop slows loading and wastes crawl budget.", "Redirect directly from the original URL to the final one.", page.chain.map((c) => `${c.status} ${c.url}`).join(" → "));
  if (!isHttps) add("health", "high", "no-https", "Site is not served over HTTPS", "Browsers mark the site as not secure and search engines favour HTTPS.", "Install a TLS certificate and redirect all HTTP traffic to HTTPS.");
  if (page.cert) {
    const days = Math.floor((page.cert.validTo.getTime() - Date.now()) / 86_400_000);
    if (days < 0) add("health", "high", "ssl-expired", "SSL certificate has expired", "Browsers show a full-page security warning.", "Renew the certificate immediately.");
    else if (days < 14) add("health", "high", "ssl-expiring", `SSL certificate expires in ${days} days`, "An expired certificate blocks visitors.", "Renew now and enable automatic renewal.");
    else if (days < 30) add("health", "medium", "ssl-expiring", `SSL certificate expires in ${days} days`, "An expired certificate blocks visitors.", "Make sure automatic renewal is working.");
  }
  if (isHttps && ctx.httpRedirectsToHttps === false) add("health", "medium", "http-no-redirect", "HTTP version does not redirect to HTTPS", "Visitors typing the plain address stay on an insecure page.", "Add a permanent (301) redirect from http:// to https://.");
  if (!ctx.sitemapOk) add("health", "low", "no-sitemap", "No sitemap.xml found", "A sitemap helps search engines discover all your pages.", "Publish /sitemap.xml and reference it in robots.txt.");

  /* ---------------- Performance (server-side signals; Lighthouse comes later) ---------------- */
  if (page.ms > 1800) add("performance", "high", "slow-response", `Slow server response (${page.ms} ms)`, "Slow responses delay everything the visitor sees.", "Add caching or a CDN, and check hosting and database speed.");
  else if (page.ms > 800) add("performance", "medium", "slow-response", `Server response could be faster (${page.ms} ms)`, "Faster responses improve Core Web Vitals.", "Add page caching or a CDN.");
  const enc = hdr("content-encoding");
  if (!enc && page.bytes > 10_000) add("performance", "medium", "no-compression", "HTML is not compressed", "Uncompressed pages take longer to download, especially on mobile.", "Enable gzip or Brotli compression on your server.");
  if (page.bytes > 500_000) add("performance", "medium", "heavy-html", `Very large HTML document (${Math.round(page.bytes / 1024)} KB)`, "Large documents slow parsing and rendering.", "Reduce inline scripts, styles and repeated markup.");
  const blocking = $("head script[src]:not([async]):not([defer]):not([type=module])").length;
  if (blocking > 0) add("performance", blocking > 3 ? "medium" : "low", "render-blocking", `${blocking} render-blocking script${blocking > 1 ? "s" : ""} in <head>`, "Blocking scripts delay the first paint.", "Add defer or async to scripts that are not needed immediately.");
  const noLazy = $("img").filter((i, el) => i > 2 && $(el).attr("loading") !== "lazy").length;
  if (noLazy > 5) add("performance", "low", "no-lazy", `${noLazy} images are not lazy-loaded`, "Offscreen images compete with content that matters.", 'Add loading="lazy" to images below the fold.');
  const noDims = $("img:not([width]):not([height])").length;
  if (noDims > 3) add("performance", "low", "img-dimensions", `${noDims} images lack width and height`, "Missing dimensions cause layout shifts (CLS).", "Set width and height attributes on images.");
  if (!hdr("cache-control") && !hdr("etag")) add("performance", "low", "no-caching", "No caching headers on the page", "Repeat visitors re-download everything.", "Set Cache-Control or ETag headers.");

  /* ---------------- SEO ---------------- */
  const title = $("title").first().text().trim();
  if (!title) add("seo", "high", "no-title", "Missing page title", "The title is the main headline in search results.", "Add a unique <title> of 30–60 characters.");
  else if (title.length < 20 || title.length > 70) add("seo", "low", "title-length", `Title length is ${title.length} characters`, "Titles outside roughly 30–60 characters get truncated or underuse space.", "Rewrite the title to 30–60 characters.", title);
  const desc = $('meta[name="description"]').attr("content")?.trim() || "";
  if (!desc) add("seo", "medium", "no-description", "Missing meta description", "Search engines often show it under your title.", "Add a meta description of 70–160 characters.");
  else if (desc.length < 50 || desc.length > 170) add("seo", "low", "description-length", `Meta description is ${desc.length} characters`, "Very short or long descriptions are rewritten or truncated.", "Aim for 70–160 characters.", desc);
  const h1s = $("h1").length;
  if (h1s === 0) add("seo", "medium", "no-h1", "No H1 heading", "The H1 tells visitors and search engines what the page is about.", "Add one clear H1 heading.");
  else if (h1s > 1) add("seo", "low", "multi-h1", `${h1s} H1 headings on the page`, "One H1 keeps the page topic unambiguous.", "Keep a single H1 and use H2–H6 for sections.");
  if (!$('link[rel="canonical"]').attr("href")) add("seo", "low", "no-canonical", "No canonical URL", "Duplicate URLs can split ranking signals.", 'Add <link rel="canonical"> pointing to the preferred URL.');
  if (/noindex/i.test($('meta[name="robots"]').attr("content") || "") || /noindex/i.test(hdr("x-robots-tag"))) add("seo", "high", "noindex", "Page is blocked from indexing (noindex)", "Search engines will drop this page from results.", "Remove the noindex directive if the page should rank.");
  if (!$("html").attr("lang")) add("seo", "low", "no-lang", "No language declared on <html>", "Helps search engines serve the page to the right audience.", 'Add a lang attribute such as <html lang="en">.');
  if (!$('meta[name="viewport"]').length) add("seo", "high", "no-viewport", "No mobile viewport meta tag", "The page will not display correctly on phones.", 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
  if (!$('meta[property="og:title"]').length) add("seo", "low", "no-og", "No Open Graph tags", "Links shared on social media will look plain.", "Add og:title, og:description and og:image.");
  if (ctx.robots === null) add("seo", "low", "no-robots", "No robots.txt found", "robots.txt tells crawlers what they may access and where the sitemap is.", "Publish /robots.txt.");
  const imgs = $("img");
  const noAlt = imgs.filter((_, el) => $(el).attr("alt") === undefined).length;
  if (noAlt > 0) add("seo", noAlt > 5 ? "medium" : "low", "img-alt-missing", `${noAlt} image${noAlt > 1 ? "s" : ""} without alt text`, "Alt text helps image search and screen readers.", "Add descriptive alt attributes (empty alt for decorative images).");

  /* ---------------- GEO readiness ---------------- */
  if (ctx.robots) {
    const blocked = AI_BOTS.filter((b) => robotsBlocks(ctx.robots!, b));
    if (blocked.length) add("geo", "medium", "ai-blocked", `robots.txt blocks AI crawlers: ${blocked.join(", ")}`, "Blocked crawlers cannot read your pages, so AI assistants may not cite you.", "Remove these Disallow rules if you want to appear in AI answers.");
  }
  if (!ctx.llmsTxt) add("geo", "low", "no-llms", "No llms.txt file", "llms.txt gives AI systems a concise guide to your site.", "Publish /llms.txt summarising your site and key pages.");
  const ld = $('script[type="application/ld+json"]');
  if (!ld.length) add("geo", "medium", "no-structured-data", "No structured data (JSON-LD)", "Structured data helps search and AI systems understand your content.", "Add schema.org markup such as Organization, Article or Product.");
  else {
    let bad = 0;
    ld.each((_, el) => { try { JSON.parse($(el).text()); } catch { bad++; } });
    if (bad) add("geo", "medium", "bad-json-ld", `${bad} structured data block${bad > 1 ? "s are" : " is"} invalid JSON`, "Invalid markup is ignored.", "Fix the JSON syntax in your ld+json scripts.");
  }
  const bodyText = $("body").clone().find("script,style,noscript").remove().end().text().replace(/\s+/g, " ").trim();
  if (bodyText.length < 300) add("geo", "medium", "thin-text", "Very little readable text in the HTML", "AI crawlers usually do not run JavaScript, so content rendered client-side may be invisible.", "Server-render your main content.");
  if ($("h2").length === 0 && bodyText.length > 1500) add("geo", "low", "no-subheadings", "No H2 subheadings", "Clear sections make content easier to extract and cite.", "Break content into sections with descriptive H2 headings.");

  /* ---------------- Security ---------------- */
  if (isHttps) {
    if (!hdr("strict-transport-security")) add("security", "medium", "hsts", "Missing HSTS header", "Browsers can be tricked into using insecure HTTP.", "Send Strict-Transport-Security: max-age=31536000; includeSubDomains.");
    const mixed = $("[src^='http://'], link[href^='http://'][rel=stylesheet]").length;
    if (mixed) add("security", "high", "mixed-content", `${mixed} insecure (http://) resource${mixed > 1 ? "s" : ""} on an HTTPS page`, "Browsers block or warn about mixed content.", "Load every resource over https://.");
  }
  if (!hdr("content-security-policy")) add("security", "medium", "csp", "Missing Content-Security-Policy header", "CSP limits the damage from injected scripts.", "Define a Content-Security-Policy that lists trusted sources.");
  if (!hdr("x-frame-options") && !/frame-ancestors/i.test(hdr("content-security-policy"))) add("security", "medium", "clickjacking", "Page can be embedded in other sites (clickjacking)", "Attackers can overlay your page inside a hostile site.", "Send X-Frame-Options: DENY or CSP frame-ancestors.");
  if (!/nosniff/i.test(hdr("x-content-type-options"))) add("security", "low", "nosniff", "Missing X-Content-Type-Options header", "Browsers may misinterpret file types.", "Send X-Content-Type-Options: nosniff.");
  if (!hdr("referrer-policy")) add("security", "low", "referrer", "Missing Referrer-Policy header", "Full URLs may leak to other sites.", "Send Referrer-Policy: strict-origin-when-cross-origin.");
  if (hdr("x-powered-by") || /\d/.test(hdr("server"))) add("security", "low", "version-leak", "Server discloses software details", "Version information helps attackers find known exploits.", "Hide X-Powered-By and server version numbers.", [hdr("server"), hdr("x-powered-by")].filter(Boolean).join(" · "));
  if (page.cert?.protocol && /TLSv1(\.0|\.1)?$/.test(page.cert.protocol)) add("security", "high", "old-tls", `Outdated TLS protocol (${page.cert.protocol})`, "Old TLS versions are insecure.", "Allow only TLS 1.2 and 1.3.");

  /* ---------------- Accessibility (static checks) ---------------- */
  const unlabeled = $("input:not([type=hidden]):not([type=submit]):not([type=button])").filter((_, el) => {
    const e = $(el);
    const id = e.attr("id");
    return !(e.attr("aria-label") || e.attr("aria-labelledby") || e.attr("title") || e.closest("label").length || (id && $(`label[for="${id}"]`).length));
  }).length;
  if (unlabeled) add("accessibility", "high", "form-labels", `${unlabeled} form field${unlabeled > 1 ? "s" : ""} without a label`, "Screen reader users cannot tell what to enter.", "Associate each input with a <label> or aria-label.");
  if (noAlt) add("accessibility", "high", "a11y-alt", `${noAlt} image${noAlt > 1 ? "s" : ""} missing an alt attribute`, "Screen readers cannot describe these images.", "Add alt text to every image.");
  const emptyLinks = $("a").filter((_, el) => {
    const e = $(el);
    return !e.text().trim() && !e.attr("aria-label") && !e.attr("title") && !e.find("img[alt]:not([alt=''])").length && !e.find("svg title").length;
  }).length;
  if (emptyLinks) add("accessibility", "medium", "empty-links", `${emptyLinks} link${emptyLinks > 1 ? "s" : ""} with no accessible name`, "Screen readers announce them as just “link”.", "Add link text or an aria-label.");
  const emptyButtons = $("button").filter((_, el) => !$(el).text().trim() && !$(el).attr("aria-label") && !$(el).attr("title")).length;
  if (emptyButtons) add("accessibility", "medium", "empty-buttons", `${emptyButtons} button${emptyButtons > 1 ? "s" : ""} with no accessible name`, "Screen readers cannot say what the button does.", "Add visible text or an aria-label.");
  if (!$("html").attr("lang")) add("accessibility", "medium", "a11y-lang", "Page language not declared", "Screen readers need it to pick the right pronunciation.", "Add a lang attribute to <html>.");
  if (!$("main, [role=main]").length) add("accessibility", "low", "no-main", "No <main> landmark", "Landmarks let keyboard and screen reader users skip to content.", "Wrap the primary content in <main>.");
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test($('meta[name="viewport"]').attr("content") || "")) add("accessibility", "medium", "zoom-blocked", "Pinch-zoom is disabled", "People with low vision rely on zooming.", "Remove user-scalable=no and maximum-scale=1 from the viewport tag.");
  const levels = $("h1,h2,h3,h4,h5,h6").map((_, el) => Number(el.tagName[1])).get();
  if (levels.some((l, i) => i > 0 && l - levels[i - 1] > 1)) add("accessibility", "low", "heading-skip", "Heading levels are skipped", "Skipped levels confuse screen reader navigation.", "Use headings in order (H2 then H3, never H2 then H4).");
  if (!title) add("accessibility", "medium", "a11y-title", "Page has no title", "The title is the first thing a screen reader announces.", "Add a descriptive <title>.");

  return out;
}
