/* Search Console data as Pagelyt caches it, and the pure calculations on top of it: real traffic per finding,
   striking-distance queries, pages with a low click rate for their position, traffic drops and pages Google has not
   indexed. Client-safe (no secrets, no fetch), so the dashboard and the assistant use the same numbers. */

import type { Finding, ModuleKey } from "../scan/types";

export type GscRow = { clicks: number; impressions: number; ctr: number; position: number };
export type GscPage = GscRow & { url: string; prevClicks: number; prevImpressions: number };
export type GscQuery = GscRow & { query: string; page: string };
export type GscInspection = { url: string; verdict: string; coverage: string | null; lastCrawl: string | null; googleCanonical: string | null; userCanonical: string | null };
/** Clicks and impressions for one device type or country (Search Console's own codes: MOBILE, DESKTOP, TABLET; ISO 3166-1 alpha-3). */
export type GscSplit = { key: string; clicks: number; impressions: number };
export type GscData = {
  property: string;
  /** Length of the window in days (7, 28 or 90). Older caches have none: 28. */
  days?: number;
  devices?: GscSplit[];
  countries?: GscSplit[];
  range: { start: string; end: string };
  prevRange: { start: string; end: string };
  totals: GscRow & { prevClicks: number; prevImpressions: number };
  daily: { date: string; clicks: number; impressions: number }[];
  pages: GscPage[];
  queries: GscQuery[];
  inspections: GscInspection[];
};

/** Same page whatever the scheme, "www.", trailing slash or #fragment. */
export function pageKey(u: string): string {
  try {
    const x = new URL(u);
    const host = x.hostname.toLowerCase().replace(/^www\./, "");
    const path = x.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path}${x.search}`;
  } catch {
    return u.toLowerCase();
  }
}

export function pageIndex(d: GscData): Map<string, GscPage> {
  const m = new Map<string, GscPage>();
  for (const p of d.pages) {
    const k = pageKey(p.url);
    const had = m.get(k);
    // http and https (or www and not) can be listed separately: add them up.
    if (had) m.set(k, { ...had, clicks: had.clicks + p.clicks, impressions: had.impressions + p.impressions, prevClicks: had.prevClicks + p.prevClicks, prevImpressions: had.prevImpressions + p.prevImpressions });
    else m.set(k, p);
  }
  return m;
}

/** Areas whose problems hit the whole site rather than one page. */
export const SITEWIDE = new Set<ModuleKey>(["health", "security", "domain", "privacy"]);

export type Traffic = { clicks: number; impressions: number; scope: "pages" | "homepage" | "site"; pages: number };

/** The Google traffic a finding puts at risk over the last 28 days: its listed pages, otherwise the whole site for
    site-wide areas, otherwise the homepage the scan checked. */
export function trafficFor(f: Finding, d: GscData, homeUrl: string, idx = pageIndex(d)): Traffic {
  if (f.pages?.rows.length) {
    let clicks = 0, impressions = 0, pages = 0;
    for (const k of new Set(f.pages.rows.map((r) => pageKey(r.url)))) {
      const p = idx.get(k);
      if (p) {
        clicks += p.clicks;
        impressions += p.impressions;
        pages++;
      }
    }
    return { clicks, impressions, scope: "pages", pages };
  }
  if (SITEWIDE.has(f.module)) return { clicks: d.totals.clicks, impressions: d.totals.impressions, scope: "site", pages: 0 };
  const h = idx.get(pageKey(homeUrl));
  return { clicks: h?.clicks ?? 0, impressions: h?.impressions ?? 0, scope: "homepage", pages: h ? 1 : 0 };
}

export function trafficMap(findings: Finding[], d: GscData, homeUrl: string, key: (f: Finding) => string): Map<string, Traffic> {
  const idx = pageIndex(d);
  return new Map(findings.map((f) => [key(f), trafficFor(f, d, homeUrl, idx)]));
}

const SEV = { high: 3, medium: 2, low: 1 } as const;
/** Most important first, then the most Google clicks at stake. */
export function byTraffic(findings: Finding[], t: Map<string, Traffic>, key: (f: Finding) => string): Finding[] {
  return [...findings].sort((a, b) => SEV[b.severity] - SEV[a.severity] || (t.get(key(b))?.clicks ?? 0) - (t.get(key(a))?.clicks ?? 0) || (t.get(key(b))?.impressions ?? 0) - (t.get(key(a))?.impressions ?? 0));
}

/** Queries just off page one (average position 8 to 20) with enough impressions to matter. */
export function strikingDistance(d: GscData, max = 15): GscQuery[] {
  return d.queries.filter((q) => q.position >= 8 && q.position <= 20 && q.impressions >= 20).sort((a, b) => b.impressions - a.impressions).slice(0, max);
}

/* A rough click-rate benchmark for positions 1 to 10 (organic results, all devices). Used only to flag pages that
   get far fewer clicks than their position suggests, never shown as a precise figure. */
const CTR_AT = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
export const expectedCtr = (pos: number) => CTR_AT[Math.min(9, Math.max(0, Math.round(pos) - 1))];

/** Pages on page one whose click rate is under half the benchmark: usually a weak title or description. */
export function lowCtr(d: GscData, max = 10): (GscPage & { expected: number })[] {
  return d.pages
    .filter((p) => p.position <= 10 && p.impressions >= 100 && p.ctr < expectedCtr(p.position) * 0.5)
    .map((p) => ({ ...p, expected: expectedCtr(p.position) }))
    .sort((a, b) => b.impressions * (b.expected - b.ctr) - a.impressions * (a.expected - a.ctr))
    .slice(0, max);
}

/** Pages that lost at least 30% of their clicks compared with the 28 days before (and had at least 10 to lose). */
export function drops(d: GscData, max = 10): (GscPage & { lost: number })[] {
  return d.pages
    .filter((p) => p.prevClicks >= 10 && p.clicks < p.prevClicks * 0.7)
    .map((p) => ({ ...p, lost: p.prevClicks - p.clicks }))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, max);
}

/** Findings that list this page, for "what changed on the pages that dropped". */
export function findingsOn(url: string, findings: Finding[]): Finding[] {
  const k = pageKey(url);
  return findings.filter((f) => f.pages?.rows.some((r) => pageKey(r.url) === k));
}

export const notIndexed = (d: GscData) => d.inspections.filter((i) => i.verdict !== "PASS");

export const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");

/** Search Console in a few lines, for the assistant's instructions. */
export function gscBrief(d: GscData, findings: Finding[], homeUrl: string, key: (f: Finding) => string): string {
  const out: string[] = [];
  const c = change(d.totals.clicks, d.totals.prevClicks);
  out.push(`Google Search Console (${d.property}), ${d.range.start} to ${d.range.end}: ${n0(d.totals.clicks)} clicks${c == null ? "" : ` (${c > 0 ? "+" : ""}${c}% vs the 28 days before)`}, ${n0(d.totals.impressions)} impressions, average position ${d.totals.position.toFixed(1)}.`);
  const t = trafficMap(findings, d, homeUrl, key);
  const top = byTraffic(findings, t, key).filter((f) => (t.get(key(f))?.clicks ?? 0) > 0).slice(0, 8);
  if (top.length) out.push(`Clicks at stake per open issue (28 days): ${top.map((f) => `[${f.id}] ${n0(t.get(key(f))!.clicks)}`).join(", ")}.`);
  const sd = strikingDistance(d, 6);
  if (sd.length) out.push(`Near page one (position 8–20): ${sd.map((q) => `"${q.query}" pos ${q.position.toFixed(1)}, ${n0(q.impressions)} impressions`).join("; ")}.`);
  const dr = drops(d, 4);
  if (dr.length) out.push(`Pages that lost clicks: ${dr.map((p) => `${p.url} ${n0(p.prevClicks)}→${n0(p.clicks)}`).join("; ")}.`);
  const ni = notIndexed(d);
  if (ni.length) out.push(`Not indexed by Google: ${ni.slice(0, 5).map((i) => `${i.url} (${i.coverage ?? i.verdict})`).join("; ")}.`);
  return out.join("\n");
}
