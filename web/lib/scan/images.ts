import * as cheerio from "cheerio";
import { safeFetch, type FetchResult } from "./fetcher";
import type { Finding, ImageAudit, PageWeight } from "./types";

/* Image audit. The page HTML gives us the image list; a HEAD request per sampled image (sent with
   an Accept header that offers AVIF and WebP, like a real browser) tells us the format and size the
   server actually delivers, so CDNs that convert images on the fly are judged fairly.
   Lighthouse (PageSpeed) adds total page weight and its own savings estimate when available. */

export const IMAGE_SAMPLE = 8;
const BIG = 300_000;
const HUGE = 1_000_000;
const LEGACY = /^image\/(jpeg|jpg|png|gif|bmp|tiff)/i;

/** First URL of a srcset / src-like attribute. */
const firstSrc = (v: string | undefined) => (v || "").trim().split(/\s*,\s*/)[0]?.split(/\s+/)[0] || "";

/** Distinct image URLs in page order (sync, no network): <img>, lazy-load attributes, then og:image. SVGs are skipped. */
export function imageList(page: FetchResult): { count: number; sample: string[] } {
  const $ = cheerio.load(page.body);
  const base = new URL(page.url);
  const seen = new Set<string>();
  const add = (raw: string) => {
    if (!raw || raw.startsWith("data:")) return;
    try {
      const u = new URL(raw, base);
      if (/^https?:$/.test(u.protocol) && !/\.svg(\?|$)/i.test(u.pathname)) seen.add(u.href);
    } catch {
      /* malformed */
    }
  };
  $("img").each((_, el) => {
    const e = $(el);
    add(e.attr("src") || e.attr("data-src") || e.attr("data-lazy-src") || firstSrc(e.attr("srcset") || e.attr("data-srcset")));
  });
  add($('meta[property="og:image"]').attr("content") || "");
  return { count: seen.size, sample: [...seen].slice(0, IMAGE_SAMPLE) };
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
