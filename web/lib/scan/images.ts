import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { safeFetch, type FetchResult } from "./fetcher";
import type { Finding, ImageAudit, PageWeight } from "./types";

/* Image audit. The page HTML gives us the image list; a HEAD request per sampled image (sent with
   an Accept header that offers AVIF and WebP, like a real browser) tells us the format and size the
   server actually delivers, so CDNs that convert images on the fly are judged fairly.
   Lighthouse (PageSpeed) adds total page weight and its own savings estimate when available. */

export const IMAGE_SAMPLE = 16;
const BIG = 300_000;
const HUGE = 1_000_000;
const LEGACY = /^image\/(jpeg|jpg|png|gif|bmp|tiff)/i;
const SVG = /\.svg(\?|$)/i;

/** Every URL in a srcset, largest candidate first (by its w or x descriptor). */
const srcsetUrls = (v: string | undefined): string[] =>
  (v || "")
    .split(/,\s+(?=\S)/)
    .map((c) => c.trim().split(/\s+/))
    .filter((c) => c[0])
    .map(([u, d]) => ({ u, n: d ? parseFloat(d) || 0 : 1 }))
    .sort((x, y) => y.n - x.n)
    .map((c) => c.u);

/** Lazy-load attributes used by common plugins and frameworks, checked before `src` (which is often a placeholder). */
const LAZY = ["data-src", "data-lazy-src", "data-original", "data-lazy", "data-url", "data-echo", "data-orig-src", "data-hi-res-src", "data-full-src"];
const LAZY_SET = ["data-srcset", "data-lazy-srcset"];
const PLACEHOLDER = /(^data:)|(blank|spacer|placeholder|transparent|pixel|lazy|loading)[^/]*\.(gif|png|svg)/i;
const BG_ATTRS = ["data-bg", "data-background", "data-bg-src", "data-background-image"];

/** Distinct image URLs in page order (sync, no network): <img> with lazy-load attributes, <noscript> fallbacks,
    <picture> sources, inline and lazy background images, preloaded images, then og/twitter images. A placeholder
    `src` shared by every lazy image counts once at most. SVGs are skipped (vectors, not a weight problem). */
export function imageList(page: FetchResult): { count: number; sample: string[]; all: string[] } {
  const all = imagesIn(cheerio.load(page.body), page.url);
  return { count: all.length, sample: all.slice(0, IMAGE_SAMPLE), all };
}

/** Most images kept per page (the crawl visits up to 30 pages; the site total is capped in index.ts). */
export const PER_PAGE_IMAGES = 150;

/** The image URLs on one parsed page. Call before scripts and <noscript> are stripped. */
export function imagesIn($: CheerioAPI, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const add = (raw: string | undefined): boolean => {
    const v = (raw || "").trim();
    if (!v || v.startsWith("data:") || v.startsWith("blob:")) return false;
    try {
      const u = new URL(v, base);
      if (!/^https?:$/.test(u.protocol) || SVG.test(u.pathname)) return false;
      seen.add(u.href);
      return true;
    } catch {
      return false;
    }
  };
  const fromImg = (attr: (name: string) => string | undefined) => {
    // A real lazy-load URL wins over the src placeholder; then src, then the largest srcset candidate.
    for (const a of LAZY) if (add(attr(a))) return;
    for (const a of LAZY_SET) if (add(srcsetUrls(attr(a))[0])) return;
    const src = attr("src");
    if (src && !PLACEHOLDER.test(src) && add(src)) return;
    if (add(srcsetUrls(attr("srcset"))[0])) return;
    add(src); // only a placeholder was there
  };
  $("img").each((_, el) => {
    const e = $(el);
    fromImg((n) => e.attr(n));
  });
  // Lazy-load scripts often keep the real <img> inside <noscript>.
  $("noscript").each((_, el) => {
    const inner = cheerio.load($(el).text() || $(el).html() || "");
    inner("img").each((__, i) => {
      const e = inner(i);
      fromImg((n) => e.attr(n));
    });
  });
  $("picture source, source[srcset]").each((_, el) => {
    const e = $(el);
    add(srcsetUrls(e.attr("srcset") || e.attr("data-srcset"))[0]);
  });
  $("[style*='url(']").each((_, el) => {
    for (const m of ($(el).attr("style") || "").matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) add(m[1]);
  });
  $(BG_ATTRS.map((a) => `[${a}]`).join(",")).each((_, el) => {
    const e = $(el);
    for (const a of BG_ATTRS) add(e.attr(a));
  });
  $('link[rel="preload"][as="image"]').each((_, el) => {
    const e = $(el);
    add(e.attr("href") || srcsetUrls(e.attr("imagesrcset"))[0]);
  });
  add($('meta[property="og:image"]').attr("content"));
  add($('meta[name="twitter:image"]').attr("content"));
  return [...seen].slice(0, PER_PAGE_IMAGES);
}

/** Adds the images Lighthouse saw load on the rendered homepage, which catches images that JavaScript inserts (the
    raw HTML doesn't have them). Our probed ones come first; Lighthouse fills in the rest with its transfer size.
    `known`: every image URL already counted from the HTML, so the total isn't counted twice. */
export function mergeRendered(img: ImageAudit, rendered: ImageAudit["probed"] | null | undefined, home: string, known: Set<string> = new Set()): ImageAudit {
  if (!rendered?.length) return img;
  const have = new Set(img.probed.map((p) => p.url));
  const extra = rendered.filter((r) => !have.has(r.url) && !SVG.test(r.url) && r.type !== "image/svg+xml").map((r) => ({ ...r, page: r.page ?? home }));
  const unseen = extra.filter((r) => !known.has(r.url)).length;
  return { ...img, count: img.count + unseen, probed: [...img.probed, ...extra] };
}

/** Up to `n` site images not checked yet, taking one from each page in turn so every page is represented. */
export function spreadSample(list: { url: string; page: string }[], skip: Set<string>, n: number): { url: string; page: string }[] {
  const byPage = new Map<string, { url: string; page: string }[]>();
  for (const i of list) if (!skip.has(i.url)) byPage.set(i.page, [...(byPage.get(i.page) ?? []), i]);
  const queues = [...byPage.values()];
  const out: { url: string; page: string }[] = [];
  const taken = new Set<string>();
  for (let round = 0; out.length < n && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      const i = q[round];
      if (i && !taken.has(i.url)) {
        taken.add(i.url);
        out.push(i);
        if (out.length >= n) break;
      }
    }
  }
  return out;
}

/** One HEAD per image. Servers that ignore HEAD or omit Content-Length leave `bytes` null. */
export async function probeImages(urls: string[]): Promise<ImageAudit["probed"]> {
  const run = Promise.all(
    urls.map(async (url) => {
      try {
        const r = await safeFetch(new URL(url), { method: "HEAD", accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" });
        if (r.status >= 400) return null;
        const len = Number(r.headers["content-length"]);
        return { url, type: String(r.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase(), bytes: Number.isFinite(len) && len > 0 ? len : null };
      } catch {
        return null;
      }
    })
  );
  const res = await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
  return (res ?? []).filter((x): x is NonNullable<typeof x> => !!x);
}

const kb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);
const short = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname.split("/").pop() || x.pathname;
  } catch {
    return u;
  }
};

export function imageFindings(img: ImageAudit, weight: PageWeight | null | undefined): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Finding["severity"], id: string, title: string, why: string, fix: string, evidence?: string) =>
    out.push({ id, module: "performance", severity, title, why, fix, evidence });

  const big = img.probed.filter((p) => p.bytes != null && p.bytes > BIG).sort((a, b) => b.bytes! - a.bytes!);
  if (big.length) {
    const huge = big.some((p) => p.bytes! > HUGE);
    add(huge ? "high" : "medium", "img-oversized", `${big.length} image${big.length > 1 ? "s are" : " is"} over ${kb(BIG)}`, "Large images are the most common reason pages load slowly on phones, and they use up visitors' data.", "Resize each image to the largest size it is actually shown at, and compress it (WebP or AVIF at 70–80% quality is usually indistinguishable).", big.slice(0, 5).map((p) => `${short(p.url)} (${kb(p.bytes!)})`).join(" · "));
  }

  // Only images big enough to matter: small PNG icons are fine as they are.
  const legacy = img.probed.filter((p) => LEGACY.test(p.type) && (p.bytes == null || p.bytes > 40_000));
  const modern = img.probed.filter((p) => /^image\/(webp|avif)/.test(p.type)).length;
  if (legacy.length >= 2 && modern === 0) add("medium", "img-legacy-format", `${legacy.length} images are served as JPEG/PNG instead of WebP or AVIF`, "Modern formats are typically 25–50% smaller at the same quality, and every current browser supports them.", "Convert images to WebP or AVIF, or turn on automatic conversion in your CDN or image plugin (Cloudflare Polish, Shopify and most WordPress image plugins do this).", legacy.slice(0, 5).map((p) => `${short(p.url)} (${p.type.replace("image/", "")})`).join(" · "));
  else if (legacy.length >= 3) add("low", "img-legacy-format", `${legacy.length} images still use JPEG/PNG`, "Some images are already WebP or AVIF; converting the rest saves more weight.", "Convert the remaining large JPEG and PNG images to WebP or AVIF.", legacy.slice(0, 5).map((p) => short(p.url)).join(" · "));

  const gifs = img.probed.filter((p) => p.type === "image/gif" && (p.bytes ?? 0) > 200_000);
  if (gifs.length) add("low", "img-heavy-gif", `${gifs.length} large animated GIF${gifs.length > 1 ? "s" : ""}`, "GIF is a very inefficient format for animation.", "Replace animated GIFs with a short muted, looping MP4 or WebM video, often 90% smaller.", gifs.map((p) => `${short(p.url)} (${kb(p.bytes!)})`).join(" · "));

  if (weight?.total != null) {
    const t = weight.total;
    const imgPart = weight.images != null ? ` (images ${kb(weight.images)})` : "";
    if (t > 5_000_000) add("high", "page-weight", `Page weighs ${kb(t)}${imgPart}`, "Pages over about 3 MB load slowly on mobile networks and cost visitors real money on metered data.", "Start with the biggest files: compress images, remove unused scripts and fonts, and lazy-load what is below the fold.");
    else if (t > 3_000_000) add("medium", "page-weight", `Page weighs ${kb(t)}${imgPart}`, "A typical fast page is under 2 MB in total.", "Compress images and remove scripts and fonts you no longer use.");
  }
  if (weight?.imageSavings != null && weight.imageSavings > 250_000 && !big.length) add("medium", "img-savings", `Images could be about ${kb(weight.imageSavings)} smaller`, "Lighthouse estimates this from image format, compression and display size.", "Serve images in WebP or AVIF, compress them and size them to how large they are shown.");
  return out;
}
