import * as cheerio from "cheerio";
import { ldNodes } from "../scan/seo-deep.ts";

/* Raw vs rendered HTML: what a crawler that doesn't run JavaScript sees, against what a browser shows.
   Pure functions (no fetching), so they are unit-tested; rendered-live.ts does the fetching and rendering. */

export type Fact = { key: string; label: string; raw: string; rendered: string; changed: boolean };

export type RenderReport = {
  url: string;
  finalUrl: string;
  rawStatus: number;
  rawWords: number;
  renderedWords: number;
  facts: Fact[];
  /** Visible text that only appears after JavaScript runs (first 150 lines), and how many there were. */
  onlyRendered: string[];
  onlyRenderedTotal: number;
  /** same: nothing important changes; some: a few things; heavy: most content or key tags need JavaScript. */
  verdict: "same" | "some" | "heavy";
};

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const words = (s: string) => (s ? s.split(" ").length : 0);
const TEXT_TAGS = "h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,blockquote,figcaption,summary,label,button,a";

type Snapshot = { facts: Record<string, string>; text: string; lines: string[] };

function snapshot(html: string, base: string): Snapshot {
  const $ = cheerio.load(html.slice(0, 2_000_000));
  const abs = (v: string | undefined) => {
    if (!v) return "";
    try {
      return new URL(v.trim(), base).href;
    } catch {
      return v.trim();
    }
  };
  const types = [...new Set(ldNodes($).flatMap((n) => (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]).map(String)))].sort();
  const facts: Record<string, string> = {
    title: squash($("title").first().text()),
    description: squash($('meta[name="description"]').attr("content") ?? ""),
    canonical: abs($('link[rel="canonical"]').attr("href")),
    robots: squash($('meta[name="robots"]').attr("content") ?? "").toLowerCase(),
    h1: $("h1").map((_, el) => squash($(el).text())).get().filter(Boolean).slice(0, 4).join(" · "),
    links: String($("a[href]").length),
    images: String($("img").length),
    jsonld: types.join(", "),
    hreflang: String($('link[rel="alternate"][hreflang]').length),
  };
  $("script,style,noscript,template,svg").remove();
  const lines = new Set<string>();
  $(TEXT_TAGS).each((_, el) => {
    const t = squash($(el).text());
    if (t.length >= 3 && t.length <= 300) lines.add(t);
  });
  return { facts, text: squash($("body").text()), lines: [...lines] };
}

const LABELS: [string, string][] = [
  ["title", "Title"],
  ["description", "Meta description"],
  ["canonical", "Canonical"],
  ["robots", "Meta robots"],
  ["h1", "H1 headings"],
  ["words", "Words of visible text"],
  ["links", "Links"],
  ["images", "Images"],
  ["jsonld", "Structured data (JSON-LD)"],
  ["hreflang", "hreflang tags"],
];
// Changes here decide how a page is indexed, so any difference counts.
const KEY = new Set(["title", "description", "canonical", "robots", "h1", "jsonld"]);

export function compareHtml(rawHtml: string, renderedHtml: string, url: string, finalUrl = url, rawStatus = 200): RenderReport {
  const raw = snapshot(rawHtml, url);
  const ren = snapshot(renderedHtml, finalUrl);
  const rawWords = words(raw.text);
  const renderedWords = words(ren.text);
  raw.facts.words = String(rawWords);
  ren.facts.words = String(renderedWords);
  const facts = LABELS.map(([key, label]) => ({ key, label, raw: raw.facts[key] ?? "", rendered: ren.facts[key] ?? "", changed: (raw.facts[key] ?? "") !== (ren.facts[key] ?? "") }));

  // A line is "only after JavaScript" when it appears nowhere in the raw page's text, not just in a different tag.
  const only = ren.lines.filter((l) => !raw.text.includes(l));
  // Drop lines contained in a longer kept line (a link inside a list item, say), so each text shows once.
  const kept = only.filter((l) => !only.some((o) => o !== l && o.length > l.length && o.includes(l)));

  const missing = renderedWords ? Math.max(0, 1 - rawWords / renderedWords) : 0;
  const keyChanged = facts.some((f) => f.changed && KEY.has(f.key));
  const verdict = missing > 0.5 || (keyChanged && !raw.facts.title) ? "heavy" : missing > 0.1 || keyChanged || kept.length > 5 ? "some" : "same";
  return { url, finalUrl, rawStatus, rawWords, renderedWords, facts, onlyRendered: kept.slice(0, 150), onlyRenderedTotal: kept.length, verdict };
}
