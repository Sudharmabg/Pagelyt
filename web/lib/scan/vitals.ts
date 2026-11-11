import type { Finding, PageWeight, Vitals, VitalsRun } from "./types";
import { parseA11y, type A11yResult, type LhAudit, type LhCategory } from "./a11y";

/* Core Web Vitals via Google's PageSpeed Insights API (runs Lighthouse for us).
   Set PAGESPEED_API_KEY for reliable quota; without it the API is heavily rate-limited
   and this step quietly returns null. Lab data is simulated; field data (real Chrome
   users) only exists for sites with enough traffic. */

const API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 28_000; // the mobile run also does the accessibility audit

type Audit = Omit<LhAudit, "details"> & { numericValue?: number; details?: { overallSavingsBytes?: number; data?: string; items?: { resourceType?: string; transferSize?: number; requestCount?: number; url?: string; mimeType?: string; statusCode?: number; data?: string; node?: { snippet?: string; selector?: string; nodeLabel?: string } }[] } };

const IMG_AUDITS = ["modern-image-formats", "uses-optimized-images", "uses-responsive-images", "image-delivery-insight"];

/** Lighthouse's own screenshots: the full final frame (shown in the report) and the last small filmstrip
   thumbnail (cheap to decode, used for the visual fingerprint). Both are JPEG data URIs. */
export type Shot = { full: string | null; thumb: string | null };

function weightOf(a: Record<string, Audit>): PageWeight {
  const items = a["resource-summary"]?.details?.items ?? [];
  const row = (t: string) => items.find((i) => i.resourceType === t);
  const savings = IMG_AUDITS.map((id) => a[id]?.details?.overallSavingsBytes).filter((n): n is number => typeof n === "number");
  return {
    total: typeof a["total-byte-weight"]?.numericValue === "number" ? a["total-byte-weight"].numericValue! : (row("total")?.transferSize ?? null),
    images: row("image")?.transferSize ?? null,
    imageSavings: savings.length ? Math.max(...savings) : null,
    requests: row("total")?.requestCount ?? null,
  };
}

export type RenderedImage = { url: string; type: string; bytes: number | null };

/** The images the rendered page actually loaded (Lighthouse's network log), largest first, up to 60. */
function imagesOf(a: Record<string, Audit>): RenderedImage[] {
  const items = a["network-requests"]?.details?.items ?? [];
  const seen = new Set<string>();
  const out: RenderedImage[] = [];
  for (const i of items) {
    if (i.resourceType !== "Image" || !i.url || !/^https?:/.test(i.url) || (i.statusCode ?? 200) >= 400 || seen.has(i.url)) continue;
    seen.add(i.url);
    out.push({ url: i.url, type: (i.mimeType ?? "").toLowerCase(), bytes: typeof i.transferSize === "number" && i.transferSize > 0 ? i.transferSize : null });
  }
  return out.sort((x, y) => (y.bytes ?? 0) - (x.bytes ?? 0)).slice(0, 60);
}

function shotOf(a: Record<string, Audit>): Shot {
  const ok = (d: unknown) => (typeof d === "string" && d.startsWith("data:image/jpeg;base64,") && d.length < 400_000 ? d : null);
  const thumbs = a["screenshot-thumbnails"]?.details?.items ?? [];
  return { full: ok(a["final-screenshot"]?.details?.data), thumb: ok(thumbs[thumbs.length - 1]?.data) };
}
type Psi = {
  lighthouseResult?: { categories?: { performance?: { score?: number | null }; accessibility?: LhCategory }; audits?: Record<string, Audit> };
  loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
};

type Run = { lab: VitalsRun | null; field: Vitals["field"]; weight: PageWeight | null; shot: Shot | null; a11y: A11yResult | null; images: RenderedImage[] };
const EMPTY: Run = { lab: null, field: null, weight: null, shot: null, a11y: null, images: [] };

async function run(url: string, strategy: "mobile" | "desktop"): Promise<Run> {
  const key = process.env.PAGESPEED_API_KEY;
  const q = new URLSearchParams({ url, strategy, category: "performance" });
  if (strategy === "mobile") q.append("category", "accessibility"); // rendered a11y checks, once per scan
  if (key) q.set("key", key);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${API}?${q}`, { signal: ctl.signal });
    if (!r.ok) return EMPTY;
    const j = (await r.json()) as Psi;
    const a = j.lighthouseResult?.audits ?? {};
    const v = (id: string) => (typeof a[id]?.numericValue === "number" ? a[id].numericValue! : null);
    const score = j.lighthouseResult?.categories?.performance?.score;
    const m = j.loadingExperience?.metrics ?? {};
    const hasField = Object.keys(m).length > 0;
    return {
      lab: {
        score: typeof score === "number" ? Math.round(score * 100) : null,
        fcp: v("first-contentful-paint"),
        lcp: v("largest-contentful-paint"),
        cls: v("cumulative-layout-shift"),
        tbt: v("total-blocking-time"),
        speedIndex: v("speed-index"),
      },
      field: hasField
        ? {
            lcp: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
            inp: m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
            cls: m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
          }
        : null,
      weight: weightOf(a),
      shot: shotOf(a),
      a11y: parseA11y(j.lighthouseResult?.categories?.accessibility, a),
      images: imagesOf(a),
    };
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchVitals(url: string): Promise<{ vitals: Vitals | null; shot: Shot | null; a11y: A11yResult | null; images: RenderedImage[] }> {
  const [mobile, desktop] = await Promise.all([run(url, "mobile"), run(url, "desktop")]);
  if (!mobile.lab && !desktop.lab) return { vitals: null, shot: null, a11y: null, images: [] };
  return {
    vitals: { mobile: mobile.lab, desktop: desktop.lab, field: mobile.field ?? desktop.field, weight: mobile.weight ?? desktop.weight, a11y: mobile.a11y?.score ?? null },
    shot: mobile.shot ?? desktop.shot,
    a11y: mobile.a11y,
    // Desktop usually loads more (fewer lazy images held back on a wider screen).
    images: desktop.images.length > mobile.images.length ? desktop.images : mobile.images,
  };
}

export function vitalsFindings(v: Vitals): Finding[] {
  const out: Finding[] = [];
  const m = v.mobile;
  const add = (severity: Finding["severity"], id: string, title: string, why: string, fix: string, evidence?: string) =>
    out.push({ id, module: "performance", severity, title, why, fix, evidence });
  if (m) {
    if (m.score != null && m.score < 50) add("high", "lh-score", `Mobile Lighthouse score is ${m.score}/100`, "Slow mobile pages lose visitors and rank lower. This is a lab test on a simulated mid-range phone.", "Start with the largest items below: images, render-blocking scripts and unused JavaScript.");
    else if (m.score != null && m.score < 80) add("medium", "lh-score", `Mobile Lighthouse score is ${m.score}/100`, "There is clear room to make the site feel faster on phones.", "Compress images, defer non-critical scripts and enable caching.");
    if (m.lcp != null && m.lcp > 4000) add("high", "lcp", `Main content takes ${(m.lcp / 1000).toFixed(1)}s to appear on mobile (LCP)`, "Largest Contentful Paint should be under 2.5 seconds. Beyond 4 seconds visitors start leaving.", "Compress and properly size the hero image, preload it, and reduce server response time.");
    else if (m.lcp != null && m.lcp > 2500) add("medium", "lcp", `Main content takes ${(m.lcp / 1000).toFixed(1)}s to appear on mobile (LCP)`, "Google's 'good' threshold for Largest Contentful Paint is 2.5 seconds.", "Optimise the largest image or heading block above the fold.");
    if (m.cls != null && m.cls > 0.25) add("high", "cls", `Layout jumps while loading (CLS ${m.cls.toFixed(2)})`, "Content shifting under the visitor's finger causes mis-taps and frustration.", "Set width and height on images and reserve space for ads, embeds and banners.");
    else if (m.cls != null && m.cls > 0.1) add("medium", "cls", `Some layout shift while loading (CLS ${m.cls.toFixed(2)})`, "Google's 'good' threshold for Cumulative Layout Shift is 0.1.", "Reserve space for late-loading images and embeds.");
    if (m.tbt != null && m.tbt > 600) add("high", "tbt", `Page is unresponsive for ${Math.round(m.tbt)} ms while loading (TBT)`, "Heavy JavaScript blocks taps and scrolling. Total Blocking Time is the lab stand-in for responsiveness.", "Split large bundles, defer third-party scripts and remove unused code.");
    else if (m.tbt != null && m.tbt > 200) add("medium", "tbt", `JavaScript blocks the page for ${Math.round(m.tbt)} ms (TBT)`, "Long tasks make the page feel sluggish.", "Defer or remove non-essential third-party scripts.");
  }
  const f = v.field;
  if (f?.inp != null && f.inp > 500) add("high", "inp", `Real users wait ${f.inp} ms after tapping (INP)`, "This is field data from real Chrome visitors. Interaction to Next Paint should be under 200 ms.", "Break up long JavaScript tasks and reduce work done on click handlers.");
  else if (f?.inp != null && f.inp > 200) add("medium", "inp", `Real-user responsiveness is slow (INP ${f.inp} ms)`, "This is field data from real Chrome visitors; under 200 ms is 'good'.", "Reduce main-thread JavaScript work around interactions.");
  return out;
}
